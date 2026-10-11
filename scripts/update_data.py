"""
每晚自動更新數據（由 GitHub Actions 執行，亦可以喺自己電腦行）：

    pip install -r scripts/requirements.txt
    python scripts/update_data.py

會寫入：
    public/data/prices/<T>.json        近 5 年每日股價（已按拆股及股息調整）
    public/data/fundamentals/<T>.json  公司資料同財務數字、下次業績日期；ETF 就係管理費、規模、十大持股
    public/data/index.json             更新時間同股票清單

股票清單喺 scripts/tickers.json，用 Yahoo 格式（例如 BRK-B）。
某隻股票攞唔到數據時會保留舊檔案，唔會令成個更新失敗。
"""
import json
import math
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
PRICES = DATA / "prices"
FUNDS = DATA / "fundamentals"


def num(x):
    """將 Yahoo 回傳值轉成 float；空值、NaN 變 None"""
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(v) or math.isinf(v) else v


def rnd(x):
    return round(x, 2) if x >= 10 else round(x, 4)


def fetch_prices(t: yf.Ticker, symbol: str):
    df = t.history(period="5y", interval="1d", auto_adjust=True)
    df = df.dropna(subset=["Close"])
    if len(df) < 20:
        raise RuntimeError(f"只有 {len(df)} 日股價")
    s = {"t": symbol, "d": [], "o": [], "h": [], "l": [], "c": [], "v": []}
    for idx, row in df.iterrows():
        c = float(row["Close"])
        s["d"].append(idx.strftime("%Y-%m-%d"))
        s["c"].append(rnd(c))
        s["o"].append(rnd(num(row["Open"]) or c))
        s["h"].append(rnd(num(row["High"]) or c))
        s["l"].append(rnd(num(row["Low"]) or c))
        s["v"].append(int(num(row["Volume"]) or 0))
    return s


def next_earnings(t: yf.Ticker):
    try:
        cal = t.calendar or {}
        dates = cal.get("Earnings Date") or []
        today = date.today()
        future = sorted(d for d in dates if isinstance(d, date) and d >= today)
        return future[0].isoformat() if future else None
    except Exception:
        return None


def fetch_fundamentals(t: yf.Ticker, symbol: str):
    info = t.info or {}
    qtype = (info.get("quoteType") or "").upper()
    price = num(info.get("currentPrice")) or num(info.get("regularMarketPrice")) or num(info.get("navPrice"))
    out = {
        "symbol": symbol,
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "type": "etf" if qtype in ("ETF", "MUTUALFUND") else "equity",
        "name": info.get("longName") or info.get("shortName") or symbol,
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "description": info.get("longBusinessSummary"),
        "url": info.get("website"),
        "beta": num(info.get("beta")) or num(info.get("beta3Year")),
    }
    if out["type"] == "etf":
        etf = {"expenseRatio": None, "totalAssets": num(info.get("totalAssets")), "category": info.get("category"), "holdings": []}
        try:
            fd = t.funds_data
            ops = fd.fund_operations
            if ops is not None and "Annual Report Expense Ratio" in ops.index:
                etf["expenseRatio"] = num(ops.loc["Annual Report Expense Ratio"].iloc[0])
            top = fd.top_holdings
            if top is not None:
                etf["holdings"] = [{"symbol": str(i), "name": str(r["Name"]), "weight": num(r["Holding Percent"])} for i, r in top.head(10).iterrows()]
        except Exception as e:  # ETF 細節攞唔到唔緊要
            print(f"  {symbol} ETF 細節：{e}", file=sys.stderr)
        if etf["expenseRatio"] is None:
            er = num(info.get("netExpenseRatio"))  # Yahoo 呢個欄位係百分比，例如 0.03 = 0.03%
            etf["expenseRatio"] = er / 100 if er is not None else None
        out["etf"] = etf
        out["dividendYield"] = num(info.get("trailingAnnualDividendYield")) or 0
        return out

    div_rate = num(info.get("dividendRate"))
    de = num(info.get("debtToEquity"))  # Yahoo 用百分比，例如 150 = 1.5 倍
    out.update({
        "marketCap": num(info.get("marketCap")),
        "pe": num(info.get("trailingPE")),
        "forwardPe": num(info.get("forwardPE")),
        "eps": num(info.get("trailingEps")),
        "revenueGrowth": num(info.get("revenueGrowth")),
        "profitMargin": num(info.get("profitMargins")),
        "dividendYield": (div_rate / price) if div_rate and price else (num(info.get("trailingAnnualDividendYield")) or 0),
        "debtToEquity": de / 100 if de is not None else None,
        "roe": num(info.get("returnOnEquity")),
        "nextEarnings": next_earnings(t),
    })
    # 蝕錢公司 Yahoo 唔會俾 trailingPE：用 EPS 判斷
    if out["pe"] is None and out["eps"] is not None and out["eps"] < 0:
        out["pe"] = -1.0
    return out


def main():
    tickers = json.loads((ROOT / "scripts" / "tickers.json").read_text())
    PRICES.mkdir(parents=True, exist_ok=True)
    FUNDS.mkdir(parents=True, exist_ok=True)
    ok, failed = [], []
    for sym in tickers:
        print(f"更新 {sym}…")
        t = yf.Ticker(sym)
        try:
            p = fetch_prices(t, sym)
            (PRICES / f"{sym}.json").write_text(json.dumps(p, separators=(",", ":")))
            ok.append({"t": sym, "from": p["d"][0], "to": p["d"][-1], "n": len(p["d"])})
        except Exception as e:
            failed.append(sym)
            print(f"  股價失敗：{e}", file=sys.stderr)
            continue
        try:
            f = fetch_fundamentals(t, sym)
            (FUNDS / f"{sym}.json").write_text(json.dumps(f, ensure_ascii=False, separators=(",", ":")))
        except Exception as e:
            print(f"  財務數據失敗：{e}", file=sys.stderr)
        time.sleep(0.5)  # 唔好太密，免得俾 Yahoo 封鎖

    index = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "source": "Yahoo Finance（經 yfinance）",
        "tickers": ok,
        "failed": failed,
    }
    (DATA / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))
    print(f"完成：{len(ok)} 隻成功，{len(failed)} 隻失敗 {failed}")
    # 超過一半失敗就當整體失敗，GitHub Actions 會亮紅燈，舊數據唔會被覆蓋
    if len(failed) > len(tickers) / 2:
        sys.exit(1)


if __name__ == "__main__":
    main()

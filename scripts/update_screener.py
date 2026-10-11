"""
每晚篩選標普 500 成份股，產生「潛力觀察」頁用嘅數據（public/data/screener.json）。

    python scripts/update_screener.py

做法：
1. 由 Wikipedia 攞標普 500 成份股名單（攞唔到就用 scripts/tickers.json）
2. 一次過下載一年股價，計回報、均線、RSI、波幅、距 52 週高位
3. 逐隻攞 Yahoo 公司資料：市盈率、收入增長、利潤率、分析員目標價同評級
4. 按四套「公開、機械式」條件揀出觀察名單（每套最多 10 隻）

呢啲名單只係數據篩選結果，唔係買賣建議。條件改咗記得同步改 src/pages/IdeasPage.jsx 嘅說明文字。
"""
import io
import json
import math
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "screener.json"
TOP_N = 10


def num(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(v) or math.isinf(v) else v


def sp500():
    """標普 500 成份股（Yahoo 格式，例如 BRK-B）"""
    try:
        req = urllib.request.Request(
            "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
            headers={"User-Agent": "Mozilla/5.0 (us-stock-helper; GitHub Actions)"},
        )
        html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
        table = pd.read_html(io.StringIO(html), attrs={"id": "constituents"})[0]
        syms = [str(s).strip().replace(".", "-") for s in table["Symbol"]]
        if len(syms) > 400:
            return syms, "標普 500"
    except Exception as e:
        print(f"攞唔到標普 500 名單：{e}", file=sys.stderr)
    return json.loads((ROOT / "scripts" / "tickers.json").read_text()), "自選清單"


def rsi(close: pd.Series, n=14):
    d = close.diff()
    gain = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    loss = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rs = gain / loss
    return float(100 - 100 / (1 + rs.iloc[-1])) if loss.iloc[-1] else 100.0


def price_metrics(close: pd.Series):
    c = close.dropna()
    if len(c) < 60:
        return None
    p = float(c.iloc[-1])

    def ret(n):
        return float(p / c.iloc[-1 - n] - 1) if len(c) > n else None

    logr = (c / c.shift(1)).apply(math.log).dropna()
    return {
        "price": round(p, 2),
        "r1m": ret(21), "r3m": ret(63), "r6m": ret(126), "r1y": ret(min(251, len(c) - 1)),
        "ma50": float(c.tail(50).mean()),
        "ma200": float(c.tail(200).mean()) if len(c) >= 200 else None,
        "rsi": rsi(c),
        "vol": float(logr.tail(252).std() * math.sqrt(252)),
        "fromHi": float(p / c.tail(252).max() - 1),
    }


def info_for(sym):
    for attempt in range(3):
        try:
            i = yf.Ticker(sym).info or {}
            if i.get("quoteType") not in (None, "EQUITY"):
                return sym, None  # 只篩選普通股
            return sym, {
                "name": i.get("shortName") or i.get("longName") or sym,
                "sector": i.get("sector"),
                "exchange": i.get("exchange"),
                "mcap": num(i.get("marketCap")),
                "pe": num(i.get("trailingPE")),
                "fpe": num(i.get("forwardPE")),
                "revG": num(i.get("revenueGrowth")),
                "epsG": num(i.get("earningsGrowth")),
                "margin": num(i.get("profitMargins")),
                "target": num(i.get("targetMeanPrice")),
                "recMean": num(i.get("recommendationMean")),  # 1 = 強烈買入 … 5 = 賣出
                "analysts": num(i.get("numberOfAnalystOpinions")),
            }
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  {sym} 第 {attempt + 1} 次失敗：{e}，{wait} 秒後再試", file=sys.stderr)
            time.sleep(wait)
    return sym, None


def pick(rows, cond, key, reverse=True):
    sel = [r for r in rows if cond(r)]
    sel.sort(key=key, reverse=reverse)
    return [r["t"] for r in sel[:TOP_N]]


def main():
    syms, universe = sp500()
    print(f"篩選 {len(syms)} 隻（{universe}）")

    # 1) 股價（一次過下載，快好多）
    df = yf.download(syms, period="1y", interval="1d", auto_adjust=True, group_by="ticker", threads=True, progress=False)
    metrics = {}
    for s in syms:
        try:
            m = price_metrics(df[s]["Close"]) if len(syms) > 1 else price_metrics(df["Close"])
            if m:
                metrics[s] = m
        except Exception:
            pass
    print(f"股價：{len(metrics)} 隻成功")

    # 2) 公司資料（逐隻，限制同時連線數，免得俾 Yahoo 封鎖）
    infos = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        for s, i in ex.map(info_for, list(metrics)):
            if i:
                infos[s] = i
    print(f"公司資料：{len(infos)} 隻成功")

    rows = []
    for s, m in metrics.items():
        i = infos.get(s)
        if not i:
            continue
        r = {"t": s, **i, **m}
        r["upside"] = (r["target"] / r["price"] - 1) if r["target"] and r["price"] else None
        rows.append(r)

    g = lambda r, k: r.get(k) if r.get(k) is not None else float("nan")  # noqa: E731
    picks = {
        # 分析員目標價上升空間：至少 10 個分析員、平均評級屬「買入」、目標價高過現價 15% 以上
        "analyst": pick(rows, lambda r: (r["analysts"] or 0) >= 10 and (r["recMean"] or 9) <= 2.2 and (r["upside"] or 0) >= 0.15,
                        key=lambda r: r["upside"]),
        # 強勢趨勢但未過熱：股價 > 50 日線 > 200 日線、RSI 50–70、年化波幅 < 60%，按 6 個月回報排
        "momentum": pick(rows, lambda r: r["ma200"] and r["price"] > r["ma50"] > r["ma200"] and 50 <= r["rsi"] <= 70
                         and r["vol"] < 0.6 and (r["r6m"] or 0) > 0, key=lambda r: r["r6m"]),
        # 高增長又賺錢：收入增長 ≥ 20%、淨利潤率 ≥ 10%、有正市盈率，按收入增長排
        "growth": pick(rows, lambda r: (r["revG"] or 0) >= 0.2 and (r["margin"] or 0) >= 0.1 and (r["pe"] or 0) > 0,
                       key=lambda r: r["revG"]),
        # 優質股回調：淨利潤率 ≥ 15%、收入仍增長 ≥ 5%、股價比 52 週高位低 15%–35%，按分析員上升空間排
        "pullback": pick(rows, lambda r: (r["margin"] or 0) >= 0.15 and (r["revG"] or 0) >= 0.05 and -0.35 <= r["fromHi"] <= -0.15,
                         key=lambda r: g(r, "upside") if not math.isnan(g(r, "upside")) else -1),
    }

    def rnd(v):
        return round(v, 4) if isinstance(v, float) else v

    out = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "universe": universe,
        "count": len(rows),
        "picks": picks,
        "rows": [{k: rnd(v) for k, v in r.items()} for r in rows],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print("完成：", {k: len(v) for k, v in picks.items()})
    # GitHub Actions 註解：喺 run 頁面一眼睇到結果
    print(f"::notice title=潛力觀察::{universe} {len(syms)} 隻，成功 {len(rows)} 隻；名單 " + ", ".join(f"{k}={len(v)}" for k, v in picks.items()))
    if len(rows) < min(50, len(syms) // 2):
        print(f"::warning title=潛力觀察::成功數目太少（{len(rows)}），當失敗處理")
        sys.exit(1)


if __name__ == "__main__":
    main()

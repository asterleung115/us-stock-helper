"""
每晚篩選標普 500 成份股，產生「潛力觀察」頁用嘅數據（public/data/screener.json）。

    python scripts/update_screener.py

做法：
1. 由 Wikipedia 攞標普 500 成份股名單（攞唔到就用 scripts/tickers.json）
2. 一次過下載一年股價，計回報、均線、RSI、波幅、距 52 週高位
3. 逐隻攞 Yahoo 公司資料：市盈率、收入增長、利潤率、分析員目標價同評級
4. 按七套「公開、機械式」條件揀出觀察名單：短期 3 套（睇股價走勢）、長期 4 套（睇公司質素）
5. 將今日每套名單頭 10 隻同當時股價加入 picks-history.json，方便日後追蹤上榜後表現

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
MARKET = ROOT / "public" / "data" / "market.json"
HISTORY = ROOT / "public" / "data" / "picks-history.json"  # workflow 會由 history 分支攞返舊記錄
TOP_N = 10
BENCH = "SPY"  # 用嚟比較表現嘅大市基準


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
        "r1d": ret(1),
        "r1m": ret(21), "r3m": ret(63), "r6m": ret(126), "r1y": ret(min(251, len(c) - 1)),
        "ma50": float(c.tail(50).mean()),
        "ma200": float(c.tail(200).mean()) if len(c) >= 200 else None,
        "rsi": rsi(c),
        "vol": float(logr.tail(252).std() * math.sqrt(252)),
        "fromHi": float(p / c.tail(252).max() - 1),
        "fromLo": float(p / c.tail(252).min() - 1),
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
                "roe": num(i.get("returnOnEquity")),
                "de": (lambda v: v / 100 if v is not None else None)(num(i.get("debtToEquity"))),  # Yahoo 用百分比
                "target": num(i.get("targetMeanPrice")),
                "recMean": num(i.get("recommendationMean")),  # 1 = 強烈買入 … 5 = 賣出
                "analysts": num(i.get("numberOfAnalystOpinions")),
            }
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  {sym} 第 {attempt + 1} 次失敗：{e}，{wait} 秒後再試", file=sys.stderr)
            time.sleep(wait)
    return sym, None


def qualify(rows, cond, key, reverse=True):
    """所有符合條件嘅股票，已排好序"""
    sel = [r for r in rows if cond(r)]
    sel.sort(key=key, reverse=reverse)
    return [r["t"] for r in sel]


def update_history(market_date, bench_price, picks, by_t):
    """每個交易日記低每套名單頭 10 隻同當時價錢；同一日重複行就覆蓋"""
    try:
        hist = json.loads(HISTORY.read_text()) if HISTORY.exists() else []
    except Exception as e:
        print(f"讀唔到 picks-history.json：{e}", file=sys.stderr)
        hist = []
    hist = [h for h in hist if h.get("d") != market_date]
    hist.append({
        "d": market_date,
        "spy": bench_price,
        "p": {k: [[t, by_t[t]["price"]] for t in v] for k, v in picks.items()},
    })
    hist.sort(key=lambda h: h["d"])
    hist = hist[-800:]  # 大約 3 年
    HISTORY.write_text(json.dumps(hist, ensure_ascii=False, separators=(",", ":")))
    return len(hist)


INDICES = [("^GSPC", "標普 500"), ("^IXIC", "納斯達克"), ("^DJI", "道瓊斯"), ("^RUT", "羅素 2000"), ("^VIX", "VIX 恐慌指數")]


def clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def build_market(rows, market_date):
    """市場總覽：指數、升跌家數、自製恐懼貪婪指數、大市貢獻、行業表現、升跌榜"""
    idx = yf.download([s for s, _ in INDICES], period="1y", interval="1d", auto_adjust=False, group_by="ticker", progress=False)
    indices, closes = [], {}
    for sym, name in INDICES:
        try:
            c = idx[sym]["Close"].dropna()
            closes[sym] = c
            indices.append({"t": sym, "name": name, "price": round(float(c.iloc[-1]), 2),
                            "chg": round(float(c.iloc[-1] - c.iloc[-2]), 2), "pct": float(c.iloc[-1] / c.iloc[-2] - 1),
                            "spark": [round(float(x), 2) for x in c.tail(60)]})
        except Exception as e:
            print(f"指數 {sym} 失敗：{e}", file=sys.stderr)

    valid = [r for r in rows if r.get("r1d") is not None]
    up = sum(r["r1d"] > 0.0005 for r in valid)
    down = sum(r["r1d"] < -0.0005 for r in valid)
    above50 = [r["price"] > r["ma50"] for r in valid if r.get("ma50")]
    above200 = [r["price"] > r["ma200"] for r in valid if r.get("ma200")]
    highs = sum(r["fromHi"] >= -0.01 for r in valid)
    lows = sum(r["fromLo"] <= 0.01 for r in valid)
    breadth = {
        "up": up, "down": down, "flat": len(valid) - up - down,
        "above50": sum(above50) / len(above50) if above50 else None,
        "above200": sum(above200) / len(above200) if above200 else None,
        "highs": highs, "lows": lows,
    }

    # 自製「恐懼貪婪指數」：5 個 0–100 分項嘅平均（概念參考 CNN Fear & Greed，但計法簡化咗）
    parts = []
    vix = closes.get("^VIX")
    if vix is not None and len(vix) > 20:
        lo, hi, v = float(vix.min()), float(vix.max()), float(vix.iloc[-1])
        parts.append({"key": "vix", "label": "VIX 恐慌指數", "score": clamp(100 * (1 - (v - lo) / (hi - lo))) if hi > lo else 50,
                      "text": f"VIX {v:.1f}，一年內介乎 {lo:.1f}–{hi:.1f}。VIX 越高代表市場越驚。"})
    spx = closes.get("^GSPC")
    if spx is not None and len(spx) > 125:
        gap = float(spx.iloc[-1] / spx.tail(125).mean() - 1)
        parts.append({"key": "momentum", "label": "大市動力", "score": clamp(50 + gap * 500),
                      "text": f"標普 500 比 125 日平均{'高' if gap >= 0 else '低'} {abs(gap) * 100:.1f}%。"})
        parts.append({"key": "rsi", "label": "大市 RSI", "score": clamp(rsi(spx)),
                      "text": f"標普 500 嘅 14 日 RSI 係 {rsi(spx):.0f}。"})
    if breadth["above50"] is not None:
        parts.append({"key": "breadth", "label": "市場闊度", "score": clamp(breadth["above50"] * 100),
                      "text": f"{breadth['above50'] * 100:.0f}% 成份股高過 50 日線。"})
    parts.append({"key": "highlow", "label": "新高 vs 新低", "score": clamp(100 * highs / (highs + lows)) if highs + lows else 50,
                  "text": f"{highs} 隻接近一年高位，{lows} 隻接近一年低位。"})
    fg = sum(p["score"] for p in parts) / len(parts)
    label = "極度恐懼" if fg < 25 else "恐懼" if fg < 45 else "中性" if fg <= 55 else "貪婪" if fg <= 75 else "極度貪婪"

    # 大市貢獻：每隻股票對標普 500 嘅影響 ≈ 市值權重 × 當日升跌 × 指數昨收
    with_cap = [r for r in valid if r.get("mcap")]
    total = sum(r["mcap"] / (1 + r["r1d"]) for r in with_cap) or 1
    spx_prev = float(spx.iloc[-2]) if spx is not None and len(spx) > 1 else None
    contrib = []
    for r in with_cap:
        w = r["mcap"] / (1 + r["r1d"]) / total
        contrib.append({"t": r["t"], "name": r["name"], "pct": r["r1d"], "pts": round(w * r["r1d"] * spx_prev, 2) if spx_prev else None, "w": w})
    contrib.sort(key=lambda x: x["pts"] or 0)

    sectors = {}
    for r in with_cap:
        s = sectors.setdefault(r.get("sector") or "其他", {"cap": 0, "d": 0, "m": 0, "n": 0})
        s["cap"] += r["mcap"]; s["d"] += r["mcap"] * r["r1d"]; s["m"] += r["mcap"] * (r.get("r1m") or 0); s["n"] += 1
    sector_list = sorted(({"sector": k, "n": v["n"], "r1d": v["d"] / v["cap"], "r1m": v["m"] / v["cap"]} for k, v in sectors.items()), key=lambda x: -x["r1d"])

    movers = sorted(valid, key=lambda r: r["r1d"])
    slim = lambda r: {"t": r["t"], "name": r["name"], "price": r["price"], "pct": r["r1d"]}  # noqa: E731
    out = {
        "date": market_date,
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "indices": indices,
        "breadth": breadth,
        "fearGreed": {"score": round(fg), "label": label, "parts": [{**p, "score": round(p["score"])} for p in parts]},
        "contrib": {"pos": [c for c in contrib[::-1][:8] if (c["pts"] or 0) > 0], "neg": [c for c in contrib[:8] if (c["pts"] or 0) < 0]},
        "sectors": sector_list,
        "gainers": [slim(r) for r in movers[::-1][:8]],
        "losers": [slim(r) for r in movers[:8]],
    }
    out["tickers"] = sorted({x["t"] for x in out["contrib"]["pos"] + out["contrib"]["neg"] + out["gainers"] + out["losers"]})
    MARKET.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"::notice title=市場總覽::{market_date} 升 {up} 跌 {down}，恐懼貪婪 {round(fg)}（{label}）")


def main():
    syms, universe = sp500()
    print(f"篩選 {len(syms)} 隻（{universe}）")

    # 1) 股價（一次過下載，快好多）
    df = yf.download(syms + [BENCH], period="1y", interval="1d", auto_adjust=True, group_by="ticker", threads=True, progress=False)
    market_date = str(df.index[-1].date())
    try:
        bench = df[BENCH]["Close"].dropna()
        bench_price = round(float(bench.iloc[-1]), 2) if len(bench) else None
    except Exception:
        bench_price = None
    metrics = {}
    for s in syms:
        try:
            m = price_metrics(df[s]["Close"])
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

    g = lambda r, k: r.get(k) if r.get(k) is not None else -1  # noqa: E731
    qual = {
        # ── 短期（幾星期至幾個月）：睇股價走勢 ──
        # 升勢強勁但未過熱：股價 > 50 日線 > 200 日線、RSI 50–70、年化波幅 < 60%，按 6 個月回報排
        "momentum": qualify(rows, lambda r: r["ma200"] and r["price"] > r["ma50"] > r["ma200"] and 50 <= r["rsi"] <= 70
                            and r["vol"] < 0.6 and (r["r6m"] or 0) > 0, key=lambda r: r["r6m"]),
        # 接近一年高位：距 52 週高位 5% 以內、股價 > 50 日線 > 200 日線、近 1 個月有升、年化波幅 < 50%，按 3 個月回報排
        "breakout": qualify(rows, lambda r: r["ma200"] and r["fromHi"] >= -0.05 and r["price"] > r["ma50"] > r["ma200"]
                            and (r["r1m"] or 0) > 0 and r["vol"] < 0.5, key=lambda r: g(r, "r3m")),
        # 長期升勢中短暫回調：股價仍高過 200 日線、6 個月回報為正、但 RSI 跌到 40 以下，按 RSI 由低至高排
        "dip": qualify(rows, lambda r: r["ma200"] and r["price"] > r["ma200"] and (r["r6m"] or 0) > 0 and r["rsi"] < 40,
                       key=lambda r: r["rsi"], reverse=False),
        # ── 長期（一年以上）：睇公司質素 ──
        # 高增長又賺錢：收入增長 ≥ 20%、淨利潤率 ≥ 10%、有正市盈率，按收入增長排
        "growth": qualify(rows, lambda r: (r["revG"] or 0) >= 0.2 and (r["margin"] or 0) >= 0.1 and (r["pe"] or 0) > 0,
                          key=lambda r: r["revG"]),
        # 穩健優質、價錢合理：淨利潤率 ≥ 20%、ROE ≥ 15%、收入增長 ≥ 5%、預測市盈率 0–25、負債/股東權益 < 1.5，按 ROE 排
        "quality": qualify(rows, lambda r: (r["margin"] or 0) >= 0.2 and (r["roe"] or 0) >= 0.15 and (r["revG"] or 0) >= 0.05
                           and 0 < (r["fpe"] or 0) <= 25 and r["de"] is not None and r["de"] < 1.5, key=lambda r: r["roe"]),
        # 賺錢公司回落中：淨利潤率 ≥ 15%、收入仍增長 ≥ 5%、股價比 52 週高位低 15%–35%，按分析員上升空間排
        "pullback": qualify(rows, lambda r: (r["margin"] or 0) >= 0.15 and (r["revG"] or 0) >= 0.05 and -0.35 <= r["fromHi"] <= -0.15,
                            key=lambda r: g(r, "upside")),
        # 分析員睇好：至少 10 個分析員、平均評級屬「買入」、目標價高過現價 15% 以上，按上升空間排
        "analyst": qualify(rows, lambda r: (r["analysts"] or 0) >= 10 and (r["recMean"] or 9) <= 2.2 and (r["upside"] or 0) >= 0.15,
                           key=lambda r: r["upside"]),
    }
    picks = {k: v[:TOP_N] for k, v in qual.items()}  # update_data.py 會攞呢啲股票嘅詳細數據

    def rnd(v):
        return round(v, 4) if isinstance(v, float) else v

    out = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "universe": universe,
        "count": len(rows),
        "date": market_date,
        "spy": bench_price,
        "picks": picks,
        "qual": qual,
        "rows": [{k: rnd(v) for k, v in r.items()} for r in rows],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    try:
        build_market(rows, market_date)
    except Exception as e:
        print(f"::warning title=市場總覽::失敗：{e}")
    n_hist = update_history(market_date, bench_price, picks, {r["t"]: r for r in rows})
    print("完成：", {k: len(v) for k, v in qual.items()}, f"；歷史記錄 {n_hist} 日")
    # GitHub Actions 註解：喺 run 頁面一眼睇到結果
    print(f"::notice title=潛力觀察::{universe} {len(syms)} 隻，成功 {len(rows)} 隻；符合條件 " + ", ".join(f"{k}={len(v)}" for k, v in qual.items()) + f"；歷史記錄 {n_hist} 日")
    if len(rows) < min(50, len(syms) // 2):
        print(f"::warning title=潛力觀察::成功數目太少（{len(rows)}），當失敗處理")
        sys.exit(1)


if __name__ == "__main__":
    main()

// 資料層：負責由唔同來源攞股價、報價同財務數據，再統一格式。
//
// 來源優先次序（逐個試，失敗就用下一個）：
//   股價 K 線： 內置快照（33 隻熱門股，近 5 年） → Alpha Vantage（任何股票，最近 100 日） → 示範數據
//   即時報價： Finnhub /quote → 用最後一日收市價代替
//   財務數據： Finnhub（profile2 + metric） → Alpha Vantage OVERVIEW → 示範數據
//
// 點解唔用 Yahoo Finance？Yahoo 嘅非官方接口唔俾瀏覽器直接讀（CORS），
// 要自己起後端轉發，所以呢個純前端版本用有正式免費方案、支援瀏覽器讀取嘅 Finnhub 同 Alpha Vantage。

import { getKeys } from './storage.js';
import { mockPrices } from './mock.js';
import { COMPANIES } from '../content/companies.js';

const cache = new Map(); // ticker -> { at, data }

/** 改咗 API key 之後要清除快取，下次會重新攞 */
export function clearCache() { cache.clear(); }
const TTL = 10 * 60 * 1000;
const BASE = import.meta.env.BASE_URL || './';

/** 帶逾時嘅 fetch，回傳 JSON */
async function getJSON(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 401 || res.status === 403) throw new Error('API key 無效或者冇權限');
    if (res.status === 429) throw new Error('用得太密，超出免費額度，請等一陣再試');
    if (!res.ok) throw new Error(`伺服器回應 ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('連線逾時');
    if (e instanceof TypeError) throw new Error('連唔到網絡（可能被瀏覽器或者網絡封鎖）');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const num = (x) => {
  const v = typeof x === 'string' ? parseFloat(x) : x;
  return v == null || Number.isNaN(v) || !Number.isFinite(v) ? null : v;
};

/* ---------------- 股價 ---------------- */

/** 內置數據清單（public/data/index.json）：邊啲股票有快照、幾時更新 */
let indexPromise = null;
export function getIndex() {
  indexPromise ??= getJSON(`${BASE}data/index.json`).catch(() => ({ updated: null, tickers: Object.keys(COMPANIES).map((t) => ({ t })) }));
  return indexPromise;
}
async function hasSnapshot(ticker) {
  const idx = await getIndex();
  return (idx.tickers || []).some((x) => x.t === ticker);
}

/** 讀內置快照（public/data/prices/XXX.json） */
export async function loadSnapshot(ticker) {
  if (!(await hasSnapshot(ticker))) return null;
  try {
    return await getJSON(`${BASE}data/prices/${ticker}.json`);
  } catch {
    return null;
  }
}

/** Alpha Vantage 每日股價（免費版：最近 100 個交易日） */
async function alphaDaily(ticker, key) {
  const j = await getJSON(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=compact&symbol=${encodeURIComponent(ticker)}&apikey=${key}`);
  if (j['Error Message']) throw new Error('搵唔到呢個代號');
  if (j.Note || j.Information) throw new Error('Alpha Vantage 免費額度已用完（每日 25 次）');
  const ts = j['Time Series (Daily)'];
  if (!ts) throw new Error('Alpha Vantage 冇回傳股價');
  const days = Object.keys(ts).sort();
  const s = { t: ticker, d: [], o: [], h: [], l: [], c: [], v: [] };
  for (const d of days) {
    const r = ts[d];
    s.d.push(d); s.o.push(+r['1. open']); s.h.push(+r['2. high']); s.l.push(+r['3. low']); s.c.push(+r['4. close']); s.v.push(+r['5. volume']);
  }
  return s;
}

/** 將較新嘅股價（例如 Alpha Vantage）接駁去快照後面 */
function appendNewer(base, newer) {
  const lastDay = base.d.at(-1);
  const out = { ...base, d: [...base.d], o: [...base.o], h: [...base.h], l: [...base.l], c: [...base.c], v: [...base.v] };
  newer.d.forEach((d, i) => {
    if (d <= lastDay) return;
    out.d.push(d); out.o.push(newer.o[i]); out.h.push(newer.h[i]); out.l.push(newer.l[i]); out.c.push(newer.c[i]); out.v.push(newer.v[i]);
  });
  return out;
}

/* ---------------- 報價 ---------------- */

async function finnhubQuote(ticker, key) {
  const q = await getJSON(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`);
  if (!q || !q.c) throw new Error('Finnhub 搵唔到報價');
  return { price: q.c, change: q.d, changePct: q.dp / 100, time: q.t ? new Date(q.t * 1000).toISOString() : null, source: 'finnhub' };
}

/* ---------------- 財務數據 ---------------- */

async function finnhubFundamentals(ticker, key) {
  const [p, m] = await Promise.all([
    getJSON(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${key}`),
    getJSON(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all&token=${key}`),
  ]);
  const mt = (m && m.metric) || {};
  if (!p?.name && !Object.keys(mt).length) throw new Error('Finnhub 冇呢隻股票嘅資料');
  const pct = (x) => (num(x) == null ? null : num(x) / 100); // Finnhub 百分比欄位係 12.3 代表 12.3%
  return {
    name: p?.name || ticker,
    sector: p?.finnhubIndustry || null,
    industry: p?.finnhubIndustry || null,
    description: null,
    logo: p?.logo || null,
    url: p?.weburl || null,
    marketCap: num(p?.marketCapitalization ?? mt.marketCapitalization) != null ? num(p?.marketCapitalization ?? mt.marketCapitalization) * 1e6 : null,
    pe: num(mt.peTTM ?? mt.peBasicExclExtraTTM ?? mt.peNormalizedAnnual),
    eps: num(mt.epsTTM ?? mt.epsBasicExclExtraItemsTTM ?? mt.epsInclExtraItemsTTM),
    revenueGrowth: pct(mt.revenueGrowthTTMYoy ?? mt.revenueGrowthQuarterlyYoy),
    profitMargin: pct(mt.netProfitMarginTTM ?? mt.netProfitMarginAnnual),
    dividendYield: pct(mt.dividendYieldIndicatedAnnual ?? mt.currentDividendYieldTTM) ?? 0,
    debtToEquity: num(mt['totalDebt/totalEquityQuarterly'] ?? mt['totalDebt/totalEquityAnnual']),
    roe: pct(mt.roeTTM ?? mt.roeRfy),
    beta: num(mt.beta),
  };
}

async function alphaOverview(ticker, key) {
  const o = await getJSON(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${key}`);
  if (o.Note || o.Information) throw new Error('Alpha Vantage 免費額度已用完（每日 25 次）');
  if (!o.Symbol) throw new Error('Alpha Vantage 冇呢隻股票嘅資料');
  return {
    name: o.Name || ticker,
    sector: o.Sector || null,
    industry: o.Industry || null,
    description: o.Description || null,
    logo: null,
    url: o.OfficialSite || null,
    marketCap: num(o.MarketCapitalization),
    pe: num(o.PERatio),
    eps: num(o.EPS),
    revenueGrowth: num(o.QuarterlyRevenueGrowthYOY),
    profitMargin: num(o.ProfitMargin),
    dividendYield: num(o.DividendYield) ?? 0,
    debtToEquity: null,
    roe: num(o.ReturnOnEquityTTM),
    beta: num(o.Beta),
  };
}

/** 每晚由 GitHub Actions（scripts/update_data.py）更新嘅財務數據快照 */
async function snapshotFundamentals(ticker) {
  if (!(await hasSnapshot(ticker))) return null;
  try {
    const f = await getJSON(`${BASE}data/fundamentals/${ticker}.json`);
    return f && f.symbol ? f : null;
  } catch {
    return null; // 舊版快照冇財務數據
  }
}

/* ---------------- 統一入口 ---------------- */

/**
 * 攞一隻股票嘅全部資料。
 * 回傳 { ticker, prices, priceSource, quote, fund, fundSource, info, notes[] }
 * notes 係俾用戶睇嘅說明（例如邊個 API 失敗、用咗示範數據）。
 */
export async function getStock(rawTicker) {
  // Yahoo 格式用「-」：BRK.B → BRK-B
  const ticker = rawTicker.trim().toUpperCase().replace(/\./g, '-');
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker)) throw new Error('代號格式唔啱，例如 AAPL、NVDA、BRK.B');
  const hit = cache.get(ticker);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const keys = getKeys();
  const notes = [];
  const info = COMPANIES[ticker] || null;

  // 1) 股價
  let prices = await loadSnapshot(ticker);
  let priceSource = prices ? 'snapshot' : null;
  if (keys.alphavantage) {
    try {
      const live = await alphaDaily(ticker, keys.alphavantage);
      if (prices) { prices = appendNewer(prices, live); priceSource = 'snapshot+alphavantage'; }
      else { prices = live; priceSource = 'alphavantage'; notes.push('Alpha Vantage 免費版只有最近 100 個交易日，所以 200 日均線等長期指標計唔到。'); }
    } catch (e) {
      notes.push(`Alpha Vantage 股價：${e.message}`);
    }
  }
  if (!prices) {
    prices = mockPrices(ticker);
    priceSource = 'mock';
    notes.push(keys.alphavantage ? '攞唔到真實股價，以下走勢係示範數據。' : '呢隻股票唔喺內置快照入面，亦未設定 Alpha Vantage key，以下走勢係示範數據。');
  }

  // 2) 報價
  let quote = null;
  if (keys.finnhub) {
    try { quote = await finnhubQuote(ticker, keys.finnhub); } catch (e) { notes.push(`Finnhub 報價：${e.message}`); }
  }
  if (!quote) {
    const c = prices.c, n = c.length;
    quote = { price: c[n - 1], change: n > 1 ? c[n - 1] - c[n - 2] : null, changePct: n > 1 ? c[n - 1] / c[n - 2] - 1 : null, time: prices.d[n - 1], source: priceSource === 'mock' ? 'mock' : 'close' };
  }

  // 3) 財務數據：Finnhub（有 key）→ 每日快照 → Alpha Vantage（有 key）
  let fund = null, fundSource = null, etf = null, nextEarnings = null;
  const snap = await snapshotFundamentals(ticker);
  if (snap?.type === 'etf' || info?.etf) {
    fundSource = 'etf';
    etf = snap?.etf || null;
  } else {
    if (keys.finnhub) {
      try { fund = await finnhubFundamentals(ticker, keys.finnhub); fundSource = 'finnhub'; } catch (e) { notes.push(`Finnhub 財務數據：${e.message}`); }
    }
    if (!fund && snap) { fund = { ...snap }; fundSource = 'snapshot-fund'; }
    if (!fund && keys.alphavantage) {
      try { fund = await alphaOverview(ticker, keys.alphavantage); fundSource = 'alphavantage'; } catch (e) { notes.push(`Alpha Vantage 財務數據：${e.message}`); }
    }
    if (!fund) {
      // 攞唔到真實財務數據：唔自動用假數字（怕新手當真），由畫面提供「睇示範」按鈕
      fundSource = 'none';
      if (!keys.finnhub && !keys.alphavantage) notes.push('呢隻股票未有財務數據快照，亦未設定 API key。去「設定」加免費 key 就會見到市盈率等真實數字。');
    }
  }
  nextEarnings = snap?.nextEarnings || null;
  const fundUpdated = snap?.updated || null;

  const data = { ticker, prices, priceSource, quote, fund, fundSource, info, notes, etf, nextEarnings, fundUpdated };
  cache.set(ticker, { at: Date.now(), data });
  return data;
}

/** 大市參考（VTI 快照），用嚟計 Beta 同相對表現 */
let marketPromise = null;
export function getMarket() {
  marketPromise ??= loadSnapshot('VTI');
  return marketPromise;
}

export const SOURCE_LABEL = {
  snapshot: '內置快照',
  'snapshot+alphavantage': '內置快照 + Alpha Vantage',
  alphavantage: 'Alpha Vantage',
  finnhub: 'Finnhub',
  close: '最後收市價',
  mock: '示範數據',
  etf: 'ETF',
  none: '未有（要 API key）',
  'snapshot-fund': '每日快照（Yahoo）',
};

// 技術指標計算（全部純函數，輸入收市價陣列，輸出同長度陣列；未夠數據嘅位置係 null）

/** 簡單移動平均線 SMA：過去 n 日收市價嘅平均 */
export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/** 指數移動平均線 EMA：越近期嘅價格權重越大 */
export function ema(values, n) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (n + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      // 用頭 n 個數嘅平均做起點
      if (i >= n - 1) {
        const slice = values.slice(i - n + 1, i + 1);
        if (slice.every((x) => x != null)) prev = slice.reduce((a, b) => a + b, 0) / n;
      }
    } else {
      prev = v * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

/** RSI（Wilder 平滑法）：0–100，>70 叫超買，<30 叫超賣 */
export function rsi(values, n = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** MACD(12, 26, 9)：快線 = EMA12 − EMA26；訊號線 = 快線嘅 EMA9；柱 = 快線 − 訊號線 */
export function macd(values, fast = 12, slow = 26, signal = 9) {
  const ef = ema(values, fast), es = ema(values, slow);
  const line = values.map((_, i) => (ef[i] != null && es[i] != null ? ef[i] - es[i] : null));
  const firstIdx = line.findIndex((x) => x != null);
  const sig = new Array(values.length).fill(null);
  if (firstIdx >= 0) {
    const tail = ema(line.slice(firstIdx), signal);
    tail.forEach((v, j) => { sig[firstIdx + j] = v; });
  }
  const hist = line.map((v, i) => (v != null && sig[i] != null ? v - sig[i] : null));
  return { line, signal: sig, hist };
}

/** 由第 n 日起計嘅回報（例如 n=252 ≈ 1 年） */
export function periodReturn(close, n) {
  return close.length > n ? close.at(-1) / close[close.length - 1 - n] - 1 : null;
}

/** 年化波幅：每日對數回報嘅標準差 × √252 */
export function annualVolatility(close, lookback = 252) {
  const start = Math.max(1, close.length - lookback);
  const r = [];
  for (let i = start; i < close.length; i++) r.push(Math.log(close[i] / close[i - 1]));
  if (r.length < 20) return null;
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1);
  return Math.sqrt(v) * Math.sqrt(252);
}

/** 最大跌幅：期內由任何高位跌到之後低位嘅最大幅度（負數） */
export function maxDrawdown(close, lookback = close.length) {
  let peak = -Infinity, dd = 0;
  for (let i = Math.max(0, close.length - lookback); i < close.length; i++) {
    peak = Math.max(peak, close[i]);
    dd = Math.min(dd, close[i] / peak - 1);
  }
  return dd;
}

/**
 * 支持位 / 阻力位：搵近期嘅「轉角位」（局部高位 / 低位），
 * 將相近（±2%）嘅價位歸為一組，次數越多越重要。
 * 返回最接近現價、喺現價之下嘅支持位同之上嘅阻力位（最多各 2 個）。
 */
export function supportResistance(high, low, close, lookback = 120, win = 5) {
  const n = close.length;
  const start = Math.max(win, n - lookback);
  const pivots = [];
  for (let i = start; i < n - win; i++) {
    const hs = high.slice(i - win, i + win + 1), ls = low.slice(i - win, i + win + 1);
    if (high[i] === Math.max(...hs)) pivots.push(high[i]);
    if (low[i] === Math.min(...ls)) pivots.push(low[i]);
  }
  const groups = [];
  for (const p of pivots.sort((a, b) => a - b)) {
    const g = groups.find((x) => Math.abs(x.price - p) / x.price < 0.02);
    if (g) { g.price = (g.price * g.count + p) / (g.count + 1); g.count++; }
    else groups.push({ price: p, count: 1 });
  }
  const price = close.at(-1);
  const supports = groups.filter((g) => g.price < price).sort((a, b) => b.price - a.price).slice(0, 2);
  const resistances = groups.filter((g) => g.price > price).sort((a, b) => a.price - b.price).slice(0, 2);
  return { supports, resistances };
}

/**
 * 趨勢線：用最近 lookback 日收市價做線性回歸（最小二乘法）。
 * slopePerDay 係每日平均變動（%），r2 越接近 1 代表走勢越「直」。
 */
export function trendLine(close, lookback = 60) {
  const n = Math.min(lookback, close.length);
  const ys = close.slice(-n);
  const xs = ys.map((_, i) => i);
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { startIndex: close.length - n, n, slope, intercept, start: intercept, end: intercept + slope * (n - 1), slopePerDay: slope / my, r2 };
}

/** Beta：同大市（例如 VTI）每日回報嘅關係，按日期對齊 */
export function beta(series, market, lookback = 252) {
  if (!market) return null;
  const mi = new Map(market.d.map((d, i) => [d, i]));
  const xs = [], ys = [];
  for (let i = Math.max(1, series.d.length - lookback); i < series.d.length; i++) {
    const j = mi.get(series.d[i]), k = mi.get(series.d[i - 1]);
    if (j == null || k == null) continue;
    ys.push(series.c[i] / series.c[i - 1] - 1);
    xs.push(market.c[j] / market.c[k] - 1);
  }
  if (xs.length < 60) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let cov = 0, vx = 0;
  for (let i = 0; i < xs.length; i++) { cov += (xs[i] - mx) * (ys[i] - my); vx += (xs[i] - mx) ** 2; }
  return cov / vx;
}

// 示範（假）數據：API 用唔到、又冇內置快照嘅時候用。
// 所有示範數據都會喺畫面標明「示範數據」，唔會扮真。

/** 由字串產生固定嘅隨機數種子，令同一個代號每次都出同一組示範數據 */
function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 產生 days 個交易日嘅示範 K 線（隨機漫步） */
export function mockPrices(ticker, days = 500, opts = {}) {
  const rand = seeded(ticker);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
  const drift = opts.drift ?? (rand() - 0.4) * 0.0012;
  const vol = opts.vol ?? 0.012 + rand() * 0.02;
  let price = opts.start ?? 20 + rand() * 280;
  const s = { t: ticker, d: [], o: [], h: [], l: [], c: [], v: [] };
  const day = new Date();
  day.setDate(day.getDate() - Math.round(days * 1.45));
  while (s.d.length < days) {
    day.setDate(day.getDate() + 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue; // 跳過週末
    const open = price * (1 + gauss() * vol * 0.3);
    const close = open * Math.exp(drift + gauss() * vol);
    const high = Math.max(open, close) * (1 + Math.abs(gauss()) * vol * 0.5);
    const low = Math.min(open, close) * (1 - Math.abs(gauss()) * vol * 0.5);
    s.d.push(day.toISOString().slice(0, 10));
    s.o.push(+open.toFixed(2)); s.h.push(+high.toFixed(2)); s.l.push(+low.toFixed(2)); s.c.push(+close.toFixed(2));
    s.v.push(Math.round(5e6 * (0.5 + rand()) * (1 + Math.abs(close / open - 1) * 30)));
    price = close;
  }
  return s;
}

/** 示範財務數據 */
export function mockFundamentals(ticker) {
  const rand = seeded(ticker + ':f');
  const pe = rand() < 0.15 ? -5 - rand() * 20 : 8 + rand() * 60;
  return {
    name: `${ticker}（示範公司）`,
    sector: '示範行業',
    industry: '示範',
    description: '呢個係示範數據，用嚟展示畫面點樣運作，唔係真實公司資料。',
    marketCap: Math.round((1 + rand() * 999) * 1e9),
    pe: +pe.toFixed(1),
    eps: +(pe > 0 ? 1 + rand() * 8 : -(rand() * 3)).toFixed(2),
    revenueGrowth: +(rand() * 0.6 - 0.1).toFixed(3),
    profitMargin: +(rand() * 0.4 - 0.08).toFixed(3),
    dividendYield: rand() < 0.5 ? 0 : +(rand() * 0.04).toFixed(4),
    debtToEquity: +(rand() * 2.5).toFixed(2),
    roe: +(rand() * 0.4 - 0.05).toFixed(3),
    beta: +(0.6 + rand() * 1.6).toFixed(2),
  };
}

/**
 * 教學用嘅「情境」股價：按指定走勢分段生成，方便出「試下睇」題目。
 * kind: 'up' 升勢 | 'down' 跌勢 | 'range' 橫行 | 'spike' 急升 | 'crash' 急跌 | 'reversal' 跌完再升
 */
export function scenario(kind, seed = 1, days = 260) {
  const plans = {
    up: [[days, 0.0018]],
    down: [[days, -0.0016]],
    range: [[days, 0]],
    spike: [[days - 25, 0.0002], [25, 0.012]],
    crash: [[days - 25, 0.0003], [25, -0.012]],
    reversal: [[Math.round(days * 0.55), -0.0022], [days - Math.round(days * 0.55), 0.0028]],
  };
  const rand = seeded(`${kind}:${seed}`);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
  const vol = 0.011;
  let price = 100;
  const s = { t: 'DEMO', d: [], o: [], h: [], l: [], c: [], v: [] };
  const day = new Date('2025-01-02T00:00:00Z');
  let mean = 100;
  for (const [len, drift] of plans[kind]) {
    for (let k = 0; k < len; k++) {
      do day.setUTCDate(day.getUTCDate() + 1); while (day.getUTCDay() === 0 || day.getUTCDay() === 6);
      // 橫行：向中間價回歸，形成明顯支持阻力
      const pull = kind === 'range' ? (mean - price) / price * 0.08 : 0;
      const open = price * (1 + gauss() * vol * 0.3);
      const close = open * Math.exp(drift + pull + gauss() * vol);
      const high = Math.max(open, close) * (1 + Math.abs(gauss()) * vol * 0.5);
      const low = Math.min(open, close) * (1 - Math.abs(gauss()) * vol * 0.5);
      s.d.push(day.toISOString().slice(0, 10));
      s.o.push(+open.toFixed(2)); s.h.push(+high.toFixed(2)); s.l.push(+low.toFixed(2)); s.c.push(+close.toFixed(2));
      const big = Math.abs(drift) > 0.005 ? 2.2 : 1;
      s.v.push(Math.round(3e6 * big * (0.6 + rand() * 0.8) * (1 + Math.abs(close / open - 1) * 40)));
      price = close;
    }
    mean = price;
  }
  return s;
}

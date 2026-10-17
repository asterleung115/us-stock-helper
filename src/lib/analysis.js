// 分析引擎：將指標同財務數字變成「白話解釋」同評分。
// 評分規則刻意簡單透明，方便新手理解每一分點嚟；佢唔係預測，亦唔係買賣建議。

import { sma, rsi, macd, periodReturn, annualVolatility, maxDrawdown, supportResistance, trendLine, beta } from './indicators.js';
import { pct, money, bigMoney } from './format.js';

/* ======================= 技術分析 ======================= */

export function technical(prices, market) {
  const c = prices.c, n = c.length, price = c[n - 1];
  const ma20 = sma(c, 20), ma50 = sma(c, 50), ma200 = sma(c, 200);
  const r = rsi(c), m = macd(c);
  const t = {
    price, n,
    ma20: ma20, ma50: ma50, ma200: ma200, rsiArr: r, macdArr: m,
    m20: ma20.at(-1), m50: ma50.at(-1), m200: ma200.at(-1),
    rsi: r.at(-1), macdLine: m.line.at(-1), macdSignal: m.signal.at(-1), macdHist: m.hist.at(-1),
    r1m: periodReturn(c, 21), r3m: periodReturn(c, 63), r1y: periodReturn(c, 252),
    vol: annualVolatility(c), mdd: maxDrawdown(c, 756),
    beta: market && prices.t !== 'VTI' ? beta(prices, market) : prices.t === 'VTI' ? 1 : null,
    marketR1y: market ? periodReturn(market.c, 252) : null,
    sr: supportResistance(prices.h, prices.l, c),
    trend: trendLine(c, 60),
    hi52: Math.max(...c.slice(-252)), lo52: Math.min(...c.slice(-252)),
  };

  // ---- 評分 ----
  let trendScore;
  if (t.m200 != null) trendScore = (price > t.m50 ? 12 : 0) + (price > t.m200 ? 14 : 0) + (t.m50 > t.m200 ? 14 : 0);
  else if (t.m50 != null) trendScore = price > t.m50 ? 24 : 8;
  else trendScore = 20;
  let momScore = 0;
  if (t.rsi != null) momScore += t.rsi > 75 ? 4 : t.rsi < 30 ? 6 : t.rsi >= 45 && t.rsi <= 65 ? 15 : 10;
  if (t.macdHist != null) momScore += (t.macdHist > 0 ? 8 : 0) + (t.macdLine > 0 ? 7 : 0);
  const riskScore = t.vol == null ? 15 : t.vol < 0.2 ? 30 : t.vol < 0.3 ? 24 : t.vol < 0.45 ? 16 : t.vol < 0.65 ? 8 : 3;
  t.parts = { trend: [trendScore, 40], momentum: [momScore, 30], risk: [riskScore, 30] };
  t.score = trendScore + momScore + riskScore;

  // ---- 趨勢描述 ----
  const slope = t.trend.slopePerDay * 21; // 約一個月
  t.trendText = Math.abs(slope) < 0.01 ? '橫行（冇明顯方向）' : slope > 0 ? `向上（過去 60 日平均每月 ${pct(slope)}）` : `向下（過去 60 日平均每月 ${pct(slope)}）`;

  // ---- 白話讀數 ----
  const items = [];
  items.push({
    key: 'trend', label: '趨勢（均線）',
    value: t.m200 != null ? `${price > t.m200 ? '高過' : '低過'} 200 日線 ${pct(price / t.m200 - 1)}` : t.m50 != null ? `${price > t.m50 ? '高過' : '低過'} 50 日線` : '數據不足',
    status: t.m200 == null ? (t.m50 == null ? 'na' : price > t.m50 ? 'good' : 'bad') : price > t.m200 && t.m50 > t.m200 ? 'good' : price < t.m200 && t.m50 < t.m200 ? 'bad' : 'mid',
    text: t.m200 == null
      ? '數據未夠 200 日，只可以睇短期均線。'
      : price > t.m200 && t.m50 > t.m200
        ? '股價企喺 200 日均線之上，50 日線又高過 200 日線：長期同中期都係升勢。'
        : price < t.m200 && t.m50 < t.m200
          ? '股價喺 200 日均線之下，50 日線亦低過 200 日線：長期處於跌勢，未見轉勢訊號。'
          : '均線訊號有好有壞，趨勢未清晰，可能喺轉勢或者整固緊。',
  });
  items.push({
    key: 'trendline', label: '趨勢線（60 日）', value: t.trendText,
    status: Math.abs(slope) < 0.01 ? 'mid' : slope > 0 ? 'good' : 'bad',
    text: `用過去 60 日收市價畫一條最貼近嘅直線。R² = ${t.trend.r2.toFixed(2)}，${t.trend.r2 > 0.6 ? '走勢幾「直」，方向明確。' : t.trend.r2 > 0.3 ? '有方向但上落唔少。' : '上上落落，冇乜方向。'}`,
  });
  items.push({
    key: 'rsi', label: 'RSI（14 日）', value: t.rsi == null ? '—' : t.rsi.toFixed(0),
    status: t.rsi == null ? 'na' : t.rsi > 70 || t.rsi < 30 ? 'mid' : 'good',
    text: t.rsi == null ? '數據不足。' : t.rsi > 70 ? '高過 70 = 「超買」：近排升得太急，短期有機會回吐。' : t.rsi < 30 ? '低過 30 = 「超賣」：近排跌得太急，可能反彈，但亦可能繼續跌。' : '喺 30–70 之間，升跌力度正常。',
  });
  items.push({
    key: 'macd', label: 'MACD', value: t.macdHist == null ? '—' : t.macdHist > 0 ? '快線在上' : '快線在下',
    status: t.macdHist == null ? 'na' : t.macdHist > 0 && t.macdLine > 0 ? 'good' : t.macdHist < 0 && t.macdLine < 0 ? 'bad' : 'mid',
    text: t.macdHist == null ? '數據不足。' : `${t.macdHist > 0 ? 'MACD 快線高過訊號線，短期動力向上' : 'MACD 快線低過訊號線，短期動力向下'}；快線${t.macdLine > 0 ? '喺零以上（整體偏強）' : '喺零以下（整體偏弱）'}。`,
  });
  items.push({
    key: 'sr', label: '支持位 / 阻力位',
    value: `${t.sr.supports[0] ? money(t.sr.supports[0].price) : '—'} / ${t.sr.resistances[0] ? money(t.sr.resistances[0].price) : '—'}`,
    status: 'info',
    text: `${t.sr.supports[0] ? `下面最近嘅支持位喺 ${money(t.sr.supports[0].price)}（距離 ${pct(t.sr.supports[0].price / price - 1)}）` : '下面暫時搵唔到明顯支持位'}；${t.sr.resistances[0] ? `上面最近嘅阻力位喺 ${money(t.sr.resistances[0].price)}（距離 ${pct(t.sr.resistances[0].price / price - 1)}）` : '上面冇明顯阻力位（喺近期高位附近）'}。`,
  });
  items.push({
    key: 'vol', label: '波幅（風險）', value: t.vol == null ? '—' : `年化 ${(t.vol * 100).toFixed(0)}%`,
    status: t.vol == null ? 'na' : t.vol < 0.25 ? 'good' : t.vol < 0.45 ? 'mid' : 'bad',
    text: t.vol == null ? '數據不足。' : `一年內股價上落 ±${(t.vol * 100).toFixed(0)}% 都算正常。成個美股大市大約 15–20%，${t.vol < 0.25 ? '呢隻同大市差唔多穩。' : `呢隻大約係大市嘅 ${(t.vol / 0.17).toFixed(1)} 倍。`}`,
  });
  items.push({
    key: 'mdd', label: '最大跌幅', value: pct(t.mdd, 0),
    status: t.mdd > -0.25 ? 'good' : t.mdd > -0.5 ? 'mid' : 'bad',
    text: `${n >= 756 ? '過去 3 年' : '有數據以來'}由高位最多跌過 ${(-t.mdd * 100).toFixed(0)}%。問吓自己：買入後蝕咁多，你頂唔頂得順？`,
  });
  if (t.r1y != null) items.push({
    key: 'r1y', label: '1 年回報', value: pct(t.r1y),
    status: t.marketR1y != null ? (t.r1y > t.marketR1y ? 'good' : t.r1y > 0 ? 'mid' : 'bad') : t.r1y > 0 ? 'good' : 'bad',
    text: t.marketR1y != null ? `同期全美股市（VTI）${pct(t.marketR1y)}，${t.r1y > t.marketR1y ? '跑贏大市。' : '跑輸大市，買 ETF 反而更好。'}` : '過去一年嘅股價變幅。',
  });
  t.items = items;
  return t;
}

/* ======================= 基本分析 ======================= */

export function fundamental(f) {
  if (!f) return null;
  const items = [];
  const pe = f.pe, eps = f.eps;

  items.push({
    key: 'mcap', label: '市值', value: bigMoney(f.marketCap), status: 'info',
    text: f.marketCap == null ? '冇數據。' : `即係成間公司喺股市值幾多錢。${f.marketCap > 200e9 ? '屬超大型公司，一般較穩陣。' : f.marketCap > 10e9 ? '屬大型公司。' : f.marketCap > 2e9 ? '屬中型公司，波動通常大啲。' : '屬細價／小型公司，風險高、波動大。'}`,
  });
  items.push({
    key: 'pe', label: '市盈率 P/E', value: pe == null ? '—' : pe < 0 ? '虧損中' : pe.toFixed(1),
    status: pe == null ? 'na' : pe < 0 ? 'bad' : pe < 25 ? 'good' : pe < 50 ? 'mid' : 'bad',
    text: pe == null ? '冇數據。'
      : pe < 0 ? '公司而家仲蝕緊錢，所以冇正常嘅市盈率。買蝕錢公司係賭佢將來會賺錢，風險較高。'
      : `市盈率係 ${pe.toFixed(1)}，意思係你畀嘅股價，大約等於公司 ${pe.toFixed(0)} 年嘅盈利。${pe < 15 ? '偏平（但要搵吓點解咁平）。' : pe < 25 ? '屬合理範圍（美股大市平均大約 20 幾倍）。' : pe < 50 ? '偏貴，市場預期佢會高增長。' : '好貴，要靠非常高增長先撐得住股價。'}`,
  });
  items.push({
    key: 'eps', label: '每股盈利 EPS', value: eps == null ? '—' : money(eps),
    status: eps == null ? 'na' : eps > 0 ? 'good' : 'bad',
    text: eps == null ? '冇數據。' : `每一股過去一年幫你賺咗 ${money(eps)}。${eps > 0 ? '正數代表有錢賺。' : '負數代表蝕錢。'}`,
  });
  items.push({
    key: 'growth', label: '收入增長', value: pct(f.revenueGrowth),
    status: f.revenueGrowth == null ? 'na' : f.revenueGrowth >= 0.1 ? 'good' : f.revenueGrowth >= 0 ? 'mid' : 'bad',
    text: f.revenueGrowth == null ? '冇數據。' : `生意額比一年前${f.revenueGrowth >= 0 ? '多咗' : '少咗'} ${(Math.abs(f.revenueGrowth) * 100).toFixed(0)}%。${f.revenueGrowth >= 0.2 ? '增長好快。' : f.revenueGrowth >= 0.05 ? '穩定增長。' : f.revenueGrowth >= 0 ? '增長慢。' : '生意萎縮緊，要搵原因。'}`,
  });
  items.push({
    key: 'margin', label: '淨利潤率', value: pct(f.profitMargin),
    status: f.profitMargin == null ? 'na' : f.profitMargin >= 0.1 ? 'good' : f.profitMargin >= 0 ? 'mid' : 'bad',
    text: f.profitMargin == null ? '冇數據。' : `每賣 $100 嘢，最後淨賺 $${(f.profitMargin * 100).toFixed(0)}。${f.profitMargin >= 0.2 ? '好賺錢。' : f.profitMargin >= 0.1 ? '幾賺錢。' : f.profitMargin >= 0 ? '利潤薄。' : '蝕緊錢。'}`,
  });
  items.push({
    key: 'div', label: '股息率', value: f.dividendYield ? pct(f.dividendYield, 2).replace('+', '') : '冇派息',
    status: 'info',
    text: f.dividendYield ? `每年大約派返股價嘅 ${(f.dividendYield * 100).toFixed(2)}% 做股息，好似收利息咁。` : '公司唔派息，通常將賺到嘅錢再投資落業務（成長股常見）。',
  });
  items.push({
    key: 'debt', label: '負債 / 股東權益', value: f.debtToEquity == null ? '—' : f.debtToEquity.toFixed(2),
    status: f.debtToEquity == null ? 'na' : f.debtToEquity < 1 ? 'good' : f.debtToEquity < 2 ? 'mid' : 'bad',
    text: f.debtToEquity == null ? '冇數據。' : `每 $1 股東資金，對應 $${f.debtToEquity.toFixed(2)} 借貸。${f.debtToEquity < 1 ? '負債唔算高。' : f.debtToEquity < 2 ? '負債偏高，要留意利息開支。' : '負債高，經濟差嗰陣壓力大。'}`,
  });
  if (f.roe != null) items.push({
    key: 'roe', label: 'ROE 股東回報率', value: pct(f.roe),
    status: f.roe >= 0.15 ? 'good' : f.roe >= 0 ? 'mid' : 'bad',
    text: `公司用股東每 $100 資金，一年賺到 $${(f.roe * 100).toFixed(0)}。15% 以上一般算好。`,
  });

  // ---- 評分 ----
  const val = pe == null ? 15 : pe < 0 ? 5 : pe < 15 ? 30 : pe < 25 ? 25 : pe < 40 ? 17 : pe < 70 ? 9 : 4;
  const g = f.revenueGrowth == null ? 12 : f.revenueGrowth >= 0.25 ? 25 : f.revenueGrowth >= 0.1 ? 20 : f.revenueGrowth >= 0 ? 12 : 4;
  const p = f.profitMargin == null ? 12 : f.profitMargin >= 0.2 ? 25 : f.profitMargin >= 0.1 ? 20 : f.profitMargin >= 0 ? 12 : 3;
  const d = f.debtToEquity == null ? 12 : f.debtToEquity < 0.5 ? 20 : f.debtToEquity < 1 ? 16 : f.debtToEquity < 2 ? 10 : 4;
  return { items, parts: { valuation: [val, 30], growth: [g, 25], profit: [p, 25], debt: [d, 20] }, score: val + g + p + d };
}

/* ======================= 籌碼面 ======================= */

/**
 * 美股冇台灣咁嘅「三大法人每日買賣」，用三樣公開數據代替：
 * 機構持股比例、沽空比例（同變化）、公司高層過去 6 個月買賣。
 */
export function chips(st) {
  if (!st || (st.instHeld == null && st.shortPct == null && !st.insider)) return null;
  const items = [];
  const inst = st.instHeld, sp = st.shortPct, ins = st.insider;

  items.push({
    key: 'inst', label: '機構持股', value: inst == null ? '—' : pct(inst, 0).replace('+', ''),
    status: inst == null ? 'na' : inst >= 0.5 ? 'good' : inst >= 0.3 ? 'mid' : 'bad',
    text: inst == null ? '冇數據。' : `基金、銀行等大機構持有大約 ${(inst * 100).toFixed(0)}% 股份。${inst >= 0.7 ? '大部分股份喺專業投資者手上，一般代表被廣泛認可。' : inst >= 0.5 ? '機構持股屬正常水平。' : inst >= 0.3 ? '機構持股偏少，股價可能較受散戶情緒影響。' : '機構好少持有，波動可能好大。'}`,
  });
  items.push({
    key: 'short', label: '沽空比例', value: sp == null ? '—' : pct(sp, 1).replace('+', ''),
    status: sp == null ? 'na' : sp < 0.05 ? 'good' : sp < 0.1 ? 'mid' : 'bad',
    text: sp == null ? '冇數據。'
      : `大約 ${(sp * 100).toFixed(1)}% 流通股被人沽空（即係賭佢跌）。${sp < 0.05 ? '屬正常水平。' : sp < 0.1 ? '偏高，有唔少人睇淡。' : '好高，好多人睇淡；但如果股價反升，沽空嘅人要買返，可能引發急升（軋空）。'}`
        + (st.shortChange != null && Math.abs(st.shortChange) >= 0.1 ? `比上個月${st.shortChange > 0 ? '增加' : '減少'}咗 ${(Math.abs(st.shortChange) * 100).toFixed(0)}%。` : '')
        + (st.shortRatio != null ? `以平均成交計，要 ${st.shortRatio.toFixed(1)} 日先平晒倉。` : ''),
  });
  const net = ins?.netPct;
  items.push({
    key: 'insider', label: '高層買賣（6 個月）',
    value: !ins ? '—' : `買 ${ins.buys ?? 0} 次 / 賣 ${ins.sells ?? 0} 次`,
    status: !ins ? 'na' : net != null && net > 0 ? 'good' : net != null && net < -0.05 ? 'bad' : 'mid',
    text: !ins ? '冇數據。' : `${net != null && net > 0 ? '公司高層淨買入自己公司股票，通常係正面訊號：佢哋最清楚公司狀況。' : '高層淨賣出。呢個好常見（例如套現股票報酬、交稅），唔一定係壞事，但大量賣出就要留意。'}${net != null ? `淨買賣佔佢哋持股 ${pct(net, 1)}。` : ''}`,
  });

  const a = inst == null ? 15 : inst >= 0.7 ? 30 : inst >= 0.5 ? 24 : inst >= 0.3 ? 16 : 8;
  let b = sp == null ? 20 : sp < 0.03 ? 40 : sp < 0.06 ? 32 : sp < 0.1 ? 22 : sp < 0.2 ? 12 : 4;
  if (sp != null && st.shortChange != null) b = Math.max(0, Math.min(40, b + (st.shortChange > 0.1 ? -5 : st.shortChange < -0.1 ? 4 : 0)));
  const c = !ins ? 15 : net != null && net > 0 ? 30 : net != null && net < -0.05 ? 8 : 18;
  return { items, parts: { inst: [a, 30], short: [b, 40], insider: [c, 30] }, score: a + b + c };
}

/* ======================= 分析員 ======================= */

export function analysts(st, price) {
  if (!st || st.recMean == null || !st.analysts || st.analysts < 3) return null;
  const up = st.target && price ? st.target / price - 1 : null;
  const rec = st.recMean;
  const recText = rec <= 1.5 ? '強烈買入' : rec <= 2.5 ? '買入' : rec <= 3.5 ? '持有' : '沽出';
  const items = [
    {
      key: 'rec', label: '平均評級', value: `${recText}（${rec.toFixed(1)}）`,
      status: rec <= 2.2 ? 'good' : rec <= 3 ? 'mid' : 'bad',
      text: `${st.analysts} 個分析員嘅平均評級。1 分 = 強烈買入，5 分 = 沽出。分析員普遍偏樂觀，「持有」其實已經算保守。`,
    },
    {
      key: 'target', label: '平均目標價', value: st.target ? `${money(st.target)}（${pct(up, 0)}）` : '—',
      status: up == null ? 'na' : up >= 0.15 ? 'good' : up >= 0 ? 'mid' : 'bad',
      text: st.target ? `分析員估計 12 個月後嘅平均價錢，最低 ${money(st.targetLow)}、最高 ${money(st.targetHigh)}。目標價經常改，亦經常估錯，只可以做參考。` : '冇數據。',
    },
  ];
  const r = Math.round(((5 - rec) / 4) * 60);
  const u = up == null ? 15 : up >= 0.3 ? 40 : up >= 0.15 ? 30 : up >= 0.05 ? 20 : up >= -0.05 ? 10 : 0;
  return { items, upside: up, recText, score: Math.max(0, Math.min(100, r + u)) };
}

/* ======================= 價格攻防 ======================= */

/** 用支持位／阻力位講吓而家股價喺邊、三個情境要留意乜 */
export function priceBattle(tech) {
  const p = tech.price;
  const s1 = tech.sr.supports[0]?.price, s2 = tech.sr.supports[1]?.price, r1 = tech.sr.resistances[0]?.price, r2 = tech.sr.resistances[1]?.price;
  const dS = s1 ? s1 / p - 1 : null, dR = r1 ? r1 / p - 1 : null;
  let state, stateText;
  if (!r1 && p >= tech.hi52 * 0.98) { state = '突破新高'; stateText = '股價喺一年高位附近，上面冇明顯阻力。'; }
  else if (dS != null && dS > -0.02) { state = '接近支撐'; stateText = `股價離支持位 ${money(s1)} 只係 ${(Math.abs(dS) * 100).toFixed(1)}%，要睇佢守唔守得住。`; }
  else if (dR != null && dR < 0.02) { state = '接近阻力'; stateText = `股價離阻力位 ${money(r1)} 只係 ${(dR * 100).toFixed(1)}%，要睇佢升唔升得穿。`; }
  else if (!s1) { state = '跌穿支撐'; stateText = '股價喺近期低位附近，下面暫時搵唔到明顯支持位。'; }
  else { state = '區間整理'; stateText = `股價喺支持位 ${money(s1)} 同阻力位 ${r1 ? money(r1) : '—'} 之間上落。`; }

  const scenarios = [
    {
      key: 'hold', label: '守住支撐',
      text: s1 ? `如果收市企穩喺 ${money(s1)} 以上，代表喺呢個價有人願意接貨，股價可能繼續喺 ${money(s1)}–${r1 ? money(r1) : '高位'} 之間上落。可以留意成交量：跌到支持位時成交減少，通常代表賣壓減弱。` : '下面暫時冇明顯支持位，可以參考 50 日線或者 200 日線。',
    },
    {
      key: 'break', label: '跌穿支撐',
      text: s1 ? `如果收市跌穿 ${money(s1)}，支持位可能變成新嘅阻力。${s2 ? `下一個支持位喺 ${money(s2)}（比現價 ${pct(s2 / p - 1)}）。` : '下面暫時冇下一個明顯支持位。'}好多人會將止蝕設喺支持位下面少少，例如 ${money(s1 * 0.97)}（低 3%），避免越跌越多。` : '股價已經喺近期低位附近。跌勢中嘅股票唔好急住「撈底」，等企穩先再諗。',
    },
    {
      key: 'breakout', label: '突破阻力',
      text: r1 ? `如果收市升穿 ${money(r1)}，而成交量明顯增加，突破會比較可信，之後呢個價可能變成新支持位。${r2 ? `再上面嘅阻力位喺 ${money(r2)}（比現價 ${pct(r2 / p - 1)}）。` : `再上面就係一年高位 ${money(tech.hi52)}。`}突破失敗（升穿後又跌返落嚟）都好常見，唔好一升就追。` : `股價已經喺高位附近。創新高嘅股票冇上方阻力，但亦容易回吐，追高要預先諗好喺邊度止蝕。`,
    },
  ];
  return { price: p, s1, s2, r1, r2, dS, dR, state, stateText, scenarios, m50: tech.m50, m200: tech.m200 };
}

/* ======================= 綜合結論 ======================= */

const tag = (score, [good, mid, bad]) => (score == null ? null : score >= 65 ? { text: good, status: 'good' } : score >= 45 ? { text: mid, status: 'mid' } : { text: bad, status: 'bad' });

/**
 * 「相對值得考慮」/「中性」/「風險較高」
 * - 綜合分數 = 有數據嘅分項（技術、基本、籌碼、分析員）平均
 * - 示範（假）財務數據唔會計入結論。
 * - ETF 本身已分散風險，額外加 5 分。
 */
export function verdict(tech, fund, { fundIsReal, isEtf, chip, analyst }) {
  const useFund = fund && fundIsReal;
  const subs = [
    { key: 'tech', label: '技術面', score: tech.score, tag: tag(tech.score, ['偏強', '中性震盪', '偏弱']) },
    { key: 'fund', label: '基本面', score: useFund ? fund.score : null, tag: useFund ? tag(fund.score, ['穩健', '一般', '偏弱']) : null },
    { key: 'chip', label: '籌碼面', score: chip?.score ?? null, tag: tag(chip?.score ?? null, ['偏正面', '中性', '偏負面']) },
    { key: 'analyst', label: '分析員', score: analyst?.score ?? null, tag: tag(analyst?.score ?? null, ['睇好', '中性', '保守']) },
  ];
  const have = subs.filter((x) => x.score != null);
  let score = Math.round(have.reduce((a, b) => a + b.score, 0) / have.length);
  if (isEtf) score = Math.min(100, score + 5);

  const reasons = [], risks = [];
  for (const it of [...tech.items, ...(useFund ? fund.items : []), ...(chip?.items || []), ...(analyst?.items || [])]) {
    if (it.status === 'good') reasons.push(`${it.label}：${it.text}`);
    if (it.status === 'bad') risks.push(`${it.label}：${it.text}`);
  }
  if (isEtf) reasons.push('ETF 一次過買入一籃子股票，單一公司出事嘅影響細好多。');

  // 硬性風險：波幅極大、曾經跌超過六成、或者公司蝕緊錢
  const losingMoney = useFund && fund.items.some((i) => i.key === 'pe' && i.value === '虧損中');
  const hardRisk = (tech.vol != null && tech.vol > 0.65) || tech.mdd < -0.6 || losingMoney;
  let level = 'neutral';
  if (score < 45 || hardRisk) level = 'risky';
  else if (score >= 65) level = 'consider';

  // 一句總結（好似「決策導航」）
  const bits = [];
  if (useFund) {
    const val = fund.parts.valuation[0];
    bits.push(`${fund.score >= 65 ? '公司基本面穩健' : fund.score >= 45 ? '公司基本面一般' : '公司基本面偏弱'}${val <= 9 ? '，但估值偏高' : val >= 25 ? '，估值合理' : ''}`);
  }
  bits.push(tech.score >= 65 ? '技術面偏強，處於升勢' : tech.score >= 45 ? '技術面中性震盪' : '技術面偏弱，處於跌勢或者轉弱');
  if (chip) bits.push(chip.score >= 65 ? '籌碼偏正面' : chip.score >= 45 ? '籌碼中性' : '籌碼偏負面（例如沽空偏多）');
  if (analyst) bits.push(analyst.score >= 65 ? '分析員普遍睇好' : analyst.score >= 45 ? '分析員看法中性' : '分析員偏保守');
  const headline = `${bits.join('；')}。`;

  const LABEL = { consider: '相對值得考慮', neutral: '中性', risky: '風險較高' };
  const SUMMARY = {
    consider: '數據上優點多過缺點，趨勢同風險都算健康。可以放入「想研究」清單，再睇埋公司業務同新聞先決定。',
    neutral: '有好有壞，未有清晰優勢。可以繼續觀察，等趨勢或者業績明朗啲先再諗。',
    risky: '有明顯風險訊號（例如波動好大、長期跌勢或者蝕錢）。新手要特別小心，就算買都只用好細比例嘅資金。',
  };
  return { level, label: LABEL[level], summary: SUMMARY[level], headline, subs, score, usedFund: !!useFund, reasons: reasons.slice(0, 6), risks: risks.slice(0, 6) };
}

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

/* ======================= 綜合結論 ======================= */

/**
 * 「相對值得考慮」/「中性」/「風險較高」
 * - 示範（假）財務數據唔會計入結論。
 * - ETF 本身已分散風險，額外加 5 分。
 */
export function verdict(tech, fund, { fundIsReal, isEtf }) {
  const useFund = fund && fundIsReal;
  let score = useFund ? Math.round(tech.score * 0.5 + fund.score * 0.5) : tech.score;
  if (isEtf) score = Math.min(100, score + 5);

  const reasons = [], risks = [];
  for (const it of [...tech.items, ...(useFund ? fund.items : [])]) {
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

  const LABEL = { consider: '相對值得考慮', neutral: '中性', risky: '風險較高' };
  const SUMMARY = {
    consider: '數據上優點多過缺點，趨勢同風險都算健康。可以放入「想研究」清單，再睇埋公司業務同新聞先決定。',
    neutral: '有好有壞，未有清晰優勢。可以繼續觀察，等趨勢或者業績明朗啲先再諗。',
    risky: '有明顯風險訊號（例如波動好大、長期跌勢或者蝕錢）。新手要特別小心，就算買都只用好細比例嘅資金。',
  };
  return { level, label: LABEL[level], summary: SUMMARY[level], score, usedFund: !!useFund, reasons: reasons.slice(0, 6), risks: risks.slice(0, 6) };
}

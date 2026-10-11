// 睇圖教學內容。每課有幾個「步驟」（每步配一個圖）同一個「試下睇」互動練習。
// 圖表數據係 scenario() 生成嘅教學用示範走勢，唔係真實股票。
import { scenario } from '../lib/mock.js';
import { sma, rsi, macd, supportResistance, trendLine } from '../lib/indicators.js';

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

export const LESSONS = [
  {
    id: 'candle',
    title: 'K 線（陰陽燭）',
    short: '一支「蠟燭」話你知一日入面股價點樣郁',
    steps: [
      {
        title: '一支 K 線 = 一日',
        body: ['每支 K 線代表一個交易日（亦可以係一個星期、一個月）。佢記錄咗四個價：開市價、收市價、最高價、最低價。',
          '想像佢係一支蠟燭：中間粗嗰段叫「實體」，上下幼嗰條線叫「影線」。'],
        chart: { kind: 'up', seed: 3, bars: 30 },
      },
      {
        title: '綠色 = 升，紅色 = 跌',
        body: ['收市價高過開市價，即係嗰日升咗，用綠色（美股習慣）。',
          '收市價低過開市價，即係嗰日跌咗，用紅色。',
          '注意：香港同台灣有啲 App 係「紅升綠跌」，用之前睇清楚設定。'],
        chart: { kind: 'up', seed: 3, bars: 30, markLast: true },
      },
      {
        title: '影線話你知「打過幾高、幾低」',
        body: ['上影線頂 = 當日最高價；下影線底 = 當日最低價。',
          '好長嘅上影線：曾經升好高，但收市前俾人沽返落嚟，代表上面有沽壓。',
          '好長嘅下影線：曾經跌好低，但有人接貨推返上去，代表下面有承接。'],
        chart: { kind: 'range', seed: 8, bars: 40 },
      },
      {
        title: '睇一排 K 線，唔好淨係睇一支',
        body: ['一支 K 線好難話到乜嘢，但連續好多支綠、而且一支比一支高，就係升勢；相反就係跌勢。',
          '新手最緊要係睇「大方向」，唔使記晒啲複雜嘅 K 線名稱。'],
        chart: { kind: 'reversal', seed: 2, bars: 120 },
      },
    ],
    quiz(seed) {
      const s = scenario(pick(['up', 'down', 'range'], seed), seed, 120);
      const idx = s.c.length - 1 - (Math.abs(seed * 7) % 30);
      const up = s.c[idx] >= s.o[idx];
      return {
        chart: { series: s, bars: 45, markers: [{ index: idx, text: '睇呢支', color: '#0ea5e9' }] },
        q: '藍色箭咀指住嗰支 K 線，嗰日係升定跌？',
        options: ['升（收市高過開市）', '跌（收市低過開市）'],
        answer: up ? 0 : 1,
        explain: `嗰日開市 $${s.o[idx]}、收市 $${s.c[idx]}，收市${up ? '高過' : '低過'}開市，所以係${up ? '綠色（升）' : '紅色（跌）'}。`,
      };
    },
  },
  {
    id: 'volume',
    title: '成交量',
    short: '有幾多人喺度買賣，話你知個走勢有冇力',
    steps: [
      {
        title: '成交量 = 當日買賣咗幾多股',
        body: ['圖底嗰啲柱就係成交量。柱越高，代表嗰日越多人買賣。',
          '柱嘅顏色通常跟返 K 線：升嗰日綠色、跌嗰日紅色。'],
        chart: { kind: 'range', seed: 5, bars: 80, volume: true },
      },
      {
        title: '價升量增 = 升得有力',
        body: ['股價升，同時成交量明顯多咗，代表好多人真金白銀追入，個升勢比較可信。',
          '如果股價升但成交量好少，可能只係少數人推高，隨時無以為繼。'],
        chart: { kind: 'spike', seed: 4, bars: 90, volume: true },
      },
      {
        title: '價跌量增 = 有人急住走',
        body: ['股價大跌兼成交量爆升，通常係有壞消息、好多人恐慌拋售。',
          '呢個時候唔好急住「撈底」，等成交量回落、股價企穩先再諗。'],
        chart: { kind: 'crash', seed: 6, bars: 90, volume: true },
      },
    ],
    quiz(seed) {
      const crash = seed % 2 === 0;
      const s = scenario(crash ? 'crash' : 'spike', seed, 140);
      return {
        chart: { series: s, bars: 90, volume: true },
        q: crash ? '圖中最後一段，股價急跌而成交量大增，最可能代表？' : '圖中最後一段，股價急升而成交量大增，最可能代表？',
        options: crash
          ? ['好多人恐慌拋售，要小心', '冇人理會，唔使擔心', '一定會即刻反彈']
          : ['好多人追入，升勢有力', '冇人理會，升勢唔可靠', '成交量同股價冇關係'],
        answer: 0,
        explain: crash
          ? '價跌量增代表好多人急住賣。佢唔代表一定繼續跌，但係一個警號，等企穩先再諗。'
          : '價升量增代表有大量資金追入，升勢較可信。不過升得急都要提防之後回吐。',
      };
    },
  },
  {
    id: 'ma',
    title: '移動平均線（MA）',
    short: '將股價「磨平」，一眼睇到大方向',
    steps: [
      {
        title: '均線 = 過去 N 日嘅平均價',
        body: ['50 日均線（藍色）= 過去 50 個交易日收市價嘅平均；200 日均線（橙色）大約係過去 10 個月。',
          '佢將每日嘅上上落落「磨平」，令你睇清楚大方向。'],
        chart: { kind: 'up', seed: 11, bars: 252, ma: [50, 200] },
      },
      {
        title: '股價喺均線之上 = 趨勢向上',
        body: ['股價企喺 200 日線上面，好多投資者會當係「長期升市」。',
          '股價跌穿 200 日線並持續喺下面，就當係「長期跌市」。'],
        chart: { kind: 'down', seed: 12, bars: 252, ma: [50, 200] },
      },
      {
        title: '黃金交叉同死亡交叉',
        body: ['50 日線由下而上穿過 200 日線，叫「黃金交叉」，通常當係轉強訊號。',
          '50 日線由上而下穿過 200 日線，叫「死亡交叉」，通常當係轉弱訊號。',
          '提提你：均線係「跟尾」嘅指標，訊號出現時股價通常已經郁咗一段。'],
        chart: { kind: 'reversal', seed: 13, bars: 260, ma: [50, 200] },
      },
    ],
    quiz(seed) {
      const s = scenario(pick(['up', 'down', 'reversal', 'range'], seed), seed, 320);
      const m50 = sma(s.c, 50).at(-1), m200 = sma(s.c, 200).at(-1), p = s.c.at(-1);
      const answer = p > m50 && m50 > m200 ? 0 : p < m50 && m50 < m200 ? 1 : 2;
      return {
        chart: { series: s, bars: 260, ma: [50, 200] },
        q: '睇最右邊（最新）嘅位置：股價、50 日線同 200 日線嘅關係話你知而家係？',
        options: ['升勢（股價 > 50 日線 > 200 日線）', '跌勢（股價 < 50 日線 < 200 日線）', '未清晰（三者交錯）'],
        answer,
        explain: `最新股價 $${p.toFixed(2)}，50 日線 $${m50.toFixed(2)}，200 日線 $${m200.toFixed(2)}。`,
      };
    },
  },
  {
    id: 'sr',
    title: '支持位同阻力位',
    short: '股價好似「地板」同「天花板」嘅位置',
    steps: [
      {
        title: '支持位 = 地板',
        body: ['股價跌到某個價位，好多次都彈返上去，呢個價位就叫「支持位」（綠色虛線）。',
          '原因：好多人覺得呢個價「抵買」，一跌到就入貨。'],
        chart: { kind: 'range', seed: 21, bars: 160, sr: true },
      },
      {
        title: '阻力位 = 天花板',
        body: ['股價升到某個價位，好多次都升唔過、跌返落嚟，就係「阻力位」（紅色虛線）。',
          '原因：之前喺呢個價買咗嘅人想「返本」就賣，形成沽壓。'],
        chart: { kind: 'range', seed: 22, bars: 160, sr: true },
      },
      {
        title: '突破之後，角色會調轉',
        body: ['如果股價配合大成交量升穿阻力位，舊嘅「天花板」好多時會變成新嘅「地板」。',
          '相反，跌穿支持位就要小心，可能會再跌一段。'],
        chart: { kind: 'spike', seed: 23, bars: 160, sr: true, volume: true },
      },
    ],
    quiz(seed) {
      const s = scenario('range', seed, 200);
      const sr = supportResistance(s.h, s.l, s.c);
      const p = s.c.at(-1);
      const sup = sr.supports[0]?.price, res = sr.resistances[0]?.price;
      const nearSup = sup != null && (res == null || p - sup < res - p);
      return {
        chart: { series: s, bars: 160, sr },
        q: '最新股價比較接近邊條線？',
        options: ['接近支持位（下面嗰條綠線）', '接近阻力位（上面嗰條紅線）'],
        answer: nearSup ? 0 : 1,
        explain: `最新股價 $${p.toFixed(2)}；支持位約 ${sup ? '$' + sup.toFixed(2) : '冇'}，阻力位約 ${res ? '$' + res.toFixed(2) : '冇'}。${nearSup ? '接近支持位時，有人會等佢企穩先買。' : '接近阻力位時，要睇吓佢升唔升得穿。'}`,
      };
    },
  },
  {
    id: 'rsi',
    title: 'RSI 相對強弱指數',
    short: '量度近排升得太急定跌得太急',
    steps: [
      {
        title: 'RSI 由 0 到 100',
        body: ['RSI 比較近 14 日「升」同「跌」嘅力度。升得多就高，跌得多就低。',
          '佢畫喺主圖下面嘅細圖入面。'],
        chart: { kind: 'range', seed: 31, bars: 160, rsi: true },
      },
      {
        title: '70 以上 = 超買，30 以下 = 超賣',
        body: ['RSI 高過 70：短時間升得太急，好似跑步跑到氣咳，有機會「抖一抖」（回調）。',
          'RSI 低過 30：跌得太急，有機會反彈。'],
        chart: { kind: 'spike', seed: 32, bars: 120, rsi: true },
      },
      {
        title: '唔好單靠 RSI 買賣',
        body: ['強勢股可以長時間 RSI 70 以上繼續升；弱勢股亦可以喺 30 以下繼續跌。',
          '最好配合趨勢（均線）一齊睇：升勢中 RSI 回落到 40 左右，可能係較好嘅位置。'],
        chart: { kind: 'crash', seed: 33, bars: 120, rsi: true },
      },
    ],
    quiz(seed) {
      const s = scenario(pick(['spike', 'crash', 'range', 'up'], seed), seed, 200);
      const r = rsi(s.c).at(-1);
      const answer = r > 70 ? 0 : r < 30 ? 1 : 2;
      return {
        chart: { series: s, bars: 120, rsi: true },
        q: '睇下面 RSI 圖最右邊嘅數值，而家屬於？',
        options: ['超買（70 以上）', '超賣（30 以下）', '正常（30–70）'],
        answer,
        explain: `最新 RSI 係 ${r.toFixed(0)}。`,
      };
    },
  },
  {
    id: 'macd',
    title: 'MACD',
    short: '睇動力有冇轉向',
    steps: [
      {
        title: 'MACD 有三樣嘢',
        body: ['藍線叫「快線」（MACD 線）；橙線叫「訊號線」，係快線嘅平均；柱狀 = 兩條線嘅距離。',
          '唔使識計，識睇就得。'],
        chart: { kind: 'reversal', seed: 41, bars: 200, macd: true },
      },
      {
        title: '快線升穿訊號線 = 動力轉強',
        body: ['藍線由下而上穿過橙線，柱由紅變綠，代表短期升勢動力加強。',
          '相反，藍線跌穿橙線、柱由綠變紅，代表動力轉弱。'],
        chart: { kind: 'reversal', seed: 42, bars: 200, macd: true },
      },
      {
        title: '零軸以上 = 整體偏強',
        body: ['快線喺 0 以上，表示短期均線高過長期均線，整體偏強；喺 0 以下就偏弱。',
          'MACD 喺橫行市好多假訊號，適合配合趨勢使用。'],
        chart: { kind: 'up', seed: 43, bars: 200, macd: true },
      },
    ],
    quiz(seed) {
      const s = scenario(pick(['up', 'down', 'reversal', 'spike', 'crash'], seed), seed, 220);
      const m = macd(s.c);
      const h = m.hist.at(-1);
      return {
        chart: { series: s, bars: 150, macd: true },
        q: '睇 MACD 圖最右邊：藍色快線同橙色訊號線邊條喺上面？',
        options: ['快線喺上面（動力向上）', '快線喺下面（動力向下）'],
        answer: h >= 0 ? 0 : 1,
        explain: `最新快線 ${m.line.at(-1).toFixed(2)}，訊號線 ${m.signal.at(-1).toFixed(2)}，柱係${h >= 0 ? '綠色（正數）' : '紅色（負數）'}。`,
      };
    },
  },
  {
    id: 'trend',
    title: '趨勢線',
    short: '用一條直線總結個方向',
    steps: [
      {
        title: '趨勢線 = 一條最貼近股價嘅直線',
        body: ['傳統做法係將幾個低位（升勢）或者高位（跌勢）用尺連埋。',
          '呢個 App 用數學方法（線性回歸）幫你畫最近 60 日最貼近嘅直線（黑色點線）。'],
        chart: { kind: 'up', seed: 51, bars: 120, trend: true },
      },
      {
        title: '斜向上、斜向下、打橫',
        body: ['斜向上 = 升勢；斜向下 = 跌勢；接近打橫 = 橫行（上落市）。',
          '線越斜，代表走勢越急。'],
        chart: { kind: 'down', seed: 52, bars: 120, trend: true },
      },
      {
        title: '跌穿趨勢線要留意',
        body: ['升勢中股價跌穿上升趨勢線，可能代表升勢放慢或者轉勢。',
          '不過一兩日跌穿未必作準，最好等幾日確認，或者配合成交量睇。'],
        chart: { kind: 'range', seed: 53, bars: 120, trend: true },
      },
    ],
    quiz(seed) {
      const s = scenario(pick(['up', 'down', 'range'], seed), seed, 160);
      const t = trendLine(s.c, 60);
      const m = t.slopePerDay * 21;
      const answer = m > 0.01 ? 0 : m < -0.01 ? 1 : 2;
      return {
        chart: { series: s, bars: 100, trend: t },
        q: '黑色點線（最近 60 日趨勢線）話你知走勢係？',
        options: ['向上', '向下', '橫行（接近打橫）'],
        answer,
        explain: `呢條線平均每個月 ${(m * 100).toFixed(1)}%。每月超過 ±1% 我哋當佢有方向。`,
      };
    },
  },
];

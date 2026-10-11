// 下載內置股價快照（近 5 年每日股價），存去 public/data/prices/
// 資料來源：https://github.com/yennanliu/finance_data （每晚由 Yahoo Finance 更新，已按拆股及股息調整）
// 用法：npm run update-data
import { mkdir, writeFile } from 'node:fs/promises';

const TICKERS = ['VTI', 'QQQ', 'SOXX', 'SOXQ', 'ROBO', 'MSFT', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'ORCL',
  'AMD', 'AVGO', 'TSM', 'INTC', 'MU', 'MRVL', 'SNDK', 'WDC', 'PLTR', 'UBER', 'SOFI', 'NU', 'GRAB', 'VST',
  'RKLB', 'IONQ', 'NBIS', 'KTOS', 'AVAV', 'ONDS', 'PL'];
const YEARS = 5;
const BASE = 'https://raw.githubusercontent.com/yennanliu/finance_data/main/data/prices/';
const OUT = new URL('../public/data/prices/', import.meta.url);

const round = (x) => (x >= 10 ? Math.round(x * 100) / 100 : Math.round(x * 10000) / 10000);

await mkdir(OUT, { recursive: true });
const cutoff = new Date();
cutoff.setFullYear(cutoff.getFullYear() - YEARS);
const cut = cutoff.toISOString().slice(0, 10);
const index = [];

for (const t of TICKERS) {
  const res = await fetch(BASE + t.toLowerCase() + '.csv');
  if (!res.ok) { console.warn(`跳過 ${t}：HTTP ${res.status}`); continue; }
  const lines = (await res.text()).trim().split('\n');
  const head = lines[0].split(',');
  const col = (n) => head.indexOf(n);
  const s = { t, d: [], o: [], h: [], l: [], c: [], v: [] };
  for (const ln of lines.slice(1)) {
    const p = ln.split(',');
    const d = p[col('date')];
    const c = parseFloat(p[col('close')]);
    if (d < cut || !isFinite(c)) continue;
    s.d.push(d); s.c.push(round(c));
    s.o.push(round(parseFloat(p[col('open')]) || c));
    s.h.push(round(parseFloat(p[col('high')]) || c));
    s.l.push(round(parseFloat(p[col('low')]) || c));
    s.v.push(Math.round(parseFloat(p[col('volume')]) || 0));
  }
  await writeFile(new URL(t + '.json', OUT), JSON.stringify(s));
  index.push({ t, from: s.d[0], to: s.d.at(-1), n: s.d.length });
  console.log(t, s.d.length, s.d[0], '→', s.d.at(-1));
}
await writeFile(new URL('../index.json', OUT), JSON.stringify({ updated: new Date().toISOString(), source: BASE, tickers: index }, null, 1));

// 潛力觀察：每晚由標普 500 按公開條件篩出嚟嘅觀察名單（scripts/update_screener.py）
// 分短期／長期、可以按行業睇、記錄每日名單嚟追蹤上榜後表現，亦可以自己追蹤個別股票。
// 呢頁只係展示篩選結果同條件，唔係推薦。
import { useEffect, useMemo, useState } from 'react';
import { Target, TrendingUp, Rocket, ArrowDownRight, ChevronRight, Mountain, Waves, ShieldCheck, Eye, EyeOff, X, History } from 'lucide-react';
import { getJSON } from '../lib/api.js';
import { load, save } from '../lib/storage.js';
import { Card, H2, Loading, EmptyState, Pill, Button, Disclaimer } from '../components/ui.jsx';
import { money, pct, bigMoney, upDown } from '../lib/format.js';

const BASE = import.meta.env.BASE_URL || './';

const recText = (m) => (m == null ? '—' : m <= 1.5 ? '強烈買入' : m <= 2.5 ? '買入' : m <= 3.5 ? '持有' : '沽出');
const plain = (x) => pct(x, 0).replace('+', '');

/** Yahoo 行業名 → 中文 */
const SECTOR_ZH = {
  Technology: '科技',
  'Communication Services': '通訊及媒體',
  'Consumer Cyclical': '非必需消費',
  'Consumer Defensive': '必需消費',
  Healthcare: '醫療',
  'Financial Services': '金融',
  Industrials: '工業',
  Energy: '能源',
  Utilities: '公用事業',
  'Real Estate': '地產',
  'Basic Materials': '原材料',
};
const sectorZh = (s) => SECTOR_ZH[s] || s || '其他';

/** 篩選條件：文字要同 scripts/update_screener.py 一致 */
const LISTS = {
  momentum: {
    icon: TrendingUp, title: '升勢強勁但未過熱',
    rule: '股價高過 50 日線、50 日線高過 200 日線、RSI 喺 50–70、年化波幅低過 60%，按 6 個月回報排。',
    caveat: '升得耐嘅股票可以突然回調。跟趨勢要配合止蝕。',
    cols: [['6 個月', (r) => <span className={upDown(r.r6m)}>{pct(r.r6m, 0)}</span>], ['RSI', (r) => r.rsi?.toFixed(0)], ['高過 200 日線', (r) => pct(r.ma200 ? r.price / r.ma200 - 1 : null, 0)]],
  },
  breakout: {
    icon: Mountain, title: '接近一年高位',
    rule: '股價距離 52 週高位 5% 以內、高過 50 日同 200 日線、近 1 個月有升、年化波幅低過 50%，按 3 個月回報排。',
    caveat: '高位亦可能係阻力位。突破失敗會跌返落嚟，追高要預咗設止蝕。',
    cols: [['距高位', (r) => pct(r.fromHi, 1)], ['1 個月', (r) => <span className={upDown(r.r1m)}>{pct(r.r1m, 0)}</span>], ['3 個月', (r) => <span className={upDown(r.r3m)}>{pct(r.r3m, 0)}</span>]],
  },
  dip: {
    icon: Waves, title: '長期升勢中短暫回調',
    rule: '股價仍然高過 200 日線、6 個月回報係正數，但 RSI 跌咗落 40 以下，按 RSI 由低至高排。',
    caveat: 'RSI 低唔代表會即刻反彈，亦可能係轉勢嘅開始。最好等股價企穩先考慮。',
    cols: [['RSI', (r) => <span className="text-down">{r.rsi?.toFixed(0)}</span>], ['1 個月', (r) => <span className={upDown(r.r1m)}>{pct(r.r1m, 0)}</span>], ['6 個月', (r) => <span className={upDown(r.r6m)}>{pct(r.r6m, 0)}</span>]],
  },
  growth: {
    icon: Rocket, title: '高增長又賺錢',
    rule: '收入按年增長 20% 以上、淨利潤率 10% 以上、有正市盈率，按收入增長排。',
    caveat: '高增長通常已經反映喺股價（市盈率可能好高）。增長一放慢，股價可以跌得好急。',
    cols: [['收入增長', (r) => <span className="text-up">{pct(r.revG, 0)}</span>], ['淨利潤率', (r) => plain(r.margin)], ['市盈率', (r) => r.pe?.toFixed(1) ?? '—']],
  },
  quality: {
    icon: ShieldCheck, title: '穩健優質、價錢合理',
    rule: '淨利潤率 20% 以上、股東權益回報率（ROE）15% 以上、收入仍增長 5% 以上、預測市盈率 25 倍以下、負債唔多過股東權益 1.5 倍，按 ROE 排。',
    caveat: '通常升得慢啲，適合長線慢慢揸。市盈率低亦可能代表市場擔心佢前景。',
    cols: [['ROE', (r) => plain(r.roe)], ['淨利潤率', (r) => plain(r.margin)], ['預測市盈率', (r) => r.fpe?.toFixed(1) ?? '—']],
  },
  pullback: {
    icon: ArrowDownRight, title: '賺錢公司回落中',
    rule: '淨利潤率 15% 以上、收入仍然增長 5% 以上、股價比 52 週高位低 15%–35%，按分析員上升空間排。',
    caveat: '跌咗唔一定係平。股價回落可能有原因（例如業績指引差、行業轉弱），要睇新聞搵原因。',
    cols: [['距 52 週高位', (r) => <span className="text-down">{pct(r.fromHi, 0)}</span>], ['淨利潤率', (r) => plain(r.margin)], ['上升空間', (r) => pct(r.upside, 0)]],
  },
  analyst: {
    icon: Target, title: '分析員睇好、目標價較高',
    rule: '至少 10 個分析員跟蹤、平均評級屬「買入」、平均目標價比現價高 15% 以上，按上升空間排。',
    caveat: '目標價係分析員對未來 12 個月嘅估計，經常會改，亦經常估錯。佢哋通常偏向樂觀。',
    cols: [['目標價', (r) => money(r.target)], ['上升空間', (r) => <span className="text-up">{pct(r.upside, 0)}</span>], ['評級', (r) => `${recText(r.recMean)}（${r.analysts} 人）`]],
  },
};

const HORIZONS = [
  { key: 'short', title: '短期', sub: '幾星期至幾個月', desc: '主要睇股價走勢（均線、RSI、近期升跌）。變化快，名單幾乎每日都會換，要睇得密同設好止蝕。', lists: ['momentum', 'breakout', 'dip'] },
  { key: 'long', title: '長期', sub: '一年以上', desc: '主要睇公司本身（增長、利潤、估值、分析員預測）。名單變得慢，適合揸長線，但要定期睇業績。', lists: ['growth', 'quality', 'pullback', 'analyst'] },
];

/** 由每日記錄計每隻股票連續上榜幾多日、上榜嗰日價錢 */
function useStreaks(hist) {
  return useMemo(() => {
    const out = {};
    if (hist.length < 2) return out; // 第一日全部都係新，唔使標
    const last = hist[hist.length - 1];
    for (const [key, items] of Object.entries(last.p || {})) {
      out[key] = {};
      for (const [t] of items) {
        let i = hist.length - 1;
        let since = null;
        while (i >= 0) {
          const hit = (hist[i].p?.[key] || []).find((x) => x[0] === t);
          if (!hit) break;
          since = { d: hist[i].d, price: hit[1], days: hist.length - i };
          i -= 1;
        }
        out[key][t] = since;
      }
    }
    return out;
  }, [hist]);
}

function TrackBtn({ on, onClick }) {
  const Icon = on ? EyeOff : Eye;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} title={on ? '取消追蹤' : '追蹤呢隻股票'}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${on ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />{on ? '追蹤中' : '追蹤'}
    </button>
  );
}

function IdeaList({ k, rows, counts, streak, open, tracked, toggleTrack, sector }) {
  const list = LISTS[k];
  const Icon = list.icon;
  const [limit, setLimit] = useState(10);
  useEffect(() => setLimit(10), [sector]);
  return (
    <Card>
      <div className="mb-2 flex items-start gap-2">
        <Icon className="mt-1 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{list.title} <span className="text-sm font-normal text-ink-500">（{rows.length} 隻符合）</span></h3>
          <p className="text-sm text-ink-600 dark:text-ink-300"><b>條件：</b>{list.rule}</p>
          <p className="text-sm text-amber-700 dark:text-amber-300"><b>要留意：</b>{list.caveat}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-500">{sector ? '呢個行業今日冇股票符合條件。' : '今日冇股票符合條件。'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs text-ink-500 dark:border-ink-700">
                <th className="py-2 font-medium">股票</th>
                <th className="py-2 text-right font-medium">現價</th>
                {list.cols.map(([h]) => <th key={h} className="py-2 text-right font-medium">{h}</th>)}
                <th className="py-2 text-right font-medium">上榜後</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((r, idx) => {
                const s = streak?.[r.t];
                return (
                  <tr key={r.t} className="cursor-pointer border-b border-ink-100 hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800/50" onClick={() => open(r.t)}>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-num font-medium">{r.t}</span>
                        {counts[r.t] > 1 && <Pill status="good">符合 {counts[r.t]} 項</Pill>}
                        {idx < 10 && s?.days === 1 && <Pill status="info">新上榜</Pill>}
                      </div>
                      <div className="max-w-[220px] truncate text-xs text-ink-500">{r.name} · {sectorZh(r.sector)}</div>
                    </td>
                    <td className="py-2 text-right font-num">{money(r.price)}</td>
                    {list.cols.map(([h, f]) => <td key={h} className="py-2 text-right font-num">{f(r)}</td>)}
                    <td className="py-2 text-right font-num text-xs">
                      {s && s.days > 1 ? (
                        <><span className={upDown(r.price / s.price - 1)}>{pct(r.price / s.price - 1, 1)}</span><div className="text-ink-500">{s.days} 日</div></>
                      ) : <span className="text-ink-400">—</span>}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TrackBtn on={tracked.has(r.t)} onClick={() => toggleTrack(r, k)} />
                        <ChevronRight className="h-4 w-4 text-ink-400" aria-label="睇分析" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && <div className="mt-3 text-center"><Button onClick={() => setLimit(limit + 10)}>顯示多 10 隻</Button></div>}
    </Card>
  );
}

/** 我自己追蹤緊嘅股票：記低開始追蹤嗰日嘅價錢，同大市比較 */
function MyTracking({ items, byT, spyNow, open, remove }) {
  if (!items.length) {
    return (
      <Card>
        <H2>我的追蹤</H2>
        <p className="text-sm text-ink-600 dark:text-ink-300">喺下面名單撳「<Eye className="inline h-3.5 w-3.5" aria-hidden /> 追蹤」，就會記低嗰日嘅收市價，之後每日自動計佢升咗定跌咗、有冇跑贏大市（標普 500 ETF：SPY）。好似模擬買入咁，唔使真錢都可以練習睇股。</p>
      </Card>
    );
  }
  return (
    <Card>
      <H2 sub="只儲存喺呢部機嘅瀏覽器">我的追蹤</H2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-right text-xs text-ink-500 dark:border-ink-700">
              <th className="py-2 text-left font-medium">股票</th><th className="font-medium">開始追蹤</th><th className="font-medium">當時價</th>
              <th className="font-medium">現價</th><th className="font-medium">回報</th><th className="font-medium">同期大市</th><th />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const now = byT.get(it.t)?.price;
              const ret = now && it.p ? now / it.p - 1 : null;
              const mkt = spyNow && it.spy ? spyNow / it.spy - 1 : null;
              const beat = ret != null && mkt != null ? ret - mkt : null;
              return (
                <tr key={it.t} className="cursor-pointer border-b border-ink-100 text-right font-num hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800/50" onClick={() => open(it.t)}>
                  <td className="py-2 text-left"><span className="font-medium">{it.t}</span><div className="font-sans text-xs text-ink-500">{LISTS[it.src]?.title || ''}</div></td>
                  <td>{it.d}</td><td>{money(it.p)}</td><td>{money(now)}</td>
                  <td className={upDown(ret)}>{pct(ret, 1)}</td>
                  <td>
                    <span className={upDown(mkt)}>{pct(mkt, 1)}</span>
                    {beat != null && <div className={`font-sans text-xs ${upDown(beat)}`}>{beat >= 0 ? '跑贏' : '跑輸'} {plain(Math.abs(beat))}</div>}
                  </td>
                  <td className="pl-2"><button type="button" onClick={(e) => { e.stopPropagation(); remove(it.t); }} title="取消追蹤" className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-red-600 dark:hover:bg-ink-800"><X className="h-4 w-4" aria-label="取消追蹤" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-500">現價係最近一個交易日嘅收市價，每日自動更新。換咗部機或者清除瀏覽器資料，追蹤記錄會唔見。</p>
    </Card>
  );
}

const LOOKBACKS = [[5, '1 星期前'], [21, '1 個月前'], [63, '3 個月前'], [126, '6 個月前']];

/** 名單過往表現：如果每日都買入當日名單頭 10 隻（每隻一樣金額），到今日平均升跌幾多 */
function TrackRecord({ hist, keys, byT, spyNow }) {
  const ready = hist.length > LOOKBACKS[0][0];
  return (
    <Card>
      <H2 sub={hist.length ? `由 ${hist[0].d} 開始記錄，共 ${hist.length} 個交易日` : ''}><span className="inline-flex items-center gap-2"><History className="h-5 w-5" aria-hidden />名單過往表現</span></H2>
      <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">
        每個交易日電腦都會記低每套名單頭 10 隻同當日價錢。下面計嘅係：如果喺嗰日將每隻都買一樣金額，揸到今日平均升跌幾多，再同大市（SPY）比較。用嚟睇吓呢套條件係咪真係有用。
      </p>
      {!ready ? (
        <p className="rounded-xl bg-ink-100 p-4 text-center text-sm dark:bg-ink-800">記錄啱啱開始，要累積多過一星期先有數字。之後每日自動更新。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-right text-xs text-ink-500 dark:border-ink-700">
                <th className="py-2 text-left font-medium">名單</th>
                {LOOKBACKS.map(([, l]) => <th key={l} className="font-medium">{l}上榜</th>)}
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k} className="border-b border-ink-100 text-right font-num dark:border-ink-800">
                  <td className="py-2 text-left font-sans">{LISTS[k].title}</td>
                  {LOOKBACKS.map(([n, l]) => {
                    const snap = hist[hist.length - 1 - n];
                    if (!snap) return <td key={l} className="text-ink-400">—</td>;
                    const rets = (snap.p?.[k] || []).map(([t, p]) => (byT.get(t)?.price && p ? byT.get(t).price / p - 1 : null)).filter((x) => x != null);
                    const avg = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : null;
                    const mkt = spyNow && snap.spy ? spyNow / snap.spy - 1 : null;
                    return (
                      <td key={l} className="py-2">
                        <span className={upDown(avg)}>{pct(avg, 1)}</span>
                        <div className="font-sans text-xs text-ink-500">大市 {pct(mkt, 1)}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-500">冇計手續費、股息同稅。過去表現唔代表將來，記錄時間短嘅話結果好受運氣影響。</p>
    </Card>
  );
}

const SORTS = [['upside', '上升空間'], ['r6m', '6 個月回報'], ['revG', '收入增長'], ['fromHi', '距高位'], ['mcap', '市值']];

function AllTable({ rows, open, sector }) {
  const [sort, setSort] = useState('mcap');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);
  const list = useMemo(() => rows
    .filter((r) => (!sector || r.sector === sector) && (!q || `${r.t} ${r.name}`.toUpperCase().includes(q.toUpperCase())))
    .sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity)), [rows, sector, sort, q]);
  return (
    <Card>
      <H2 sub={`${list.length} 隻${sector ? `（${sectorZh(sector)}）` : ''}`}>全部篩選數據</H2>
      <div className="mb-3 flex flex-wrap gap-2">
        <label htmlFor="all-q" className="sr-only">搜尋</label>
        <input id="all-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="代號或名稱" className="w-40 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-900" />
        <label htmlFor="all-sort" className="sr-only">排序</label>
        <select id="all-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-900">
          {SORTS.map(([k, l]) => <option key={k} value={k}>按{l}排</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-right text-xs text-ink-500 dark:border-ink-700">
              <th className="py-2 text-left font-medium">股票</th><th className="font-medium">市值</th><th className="font-medium">現價</th><th className="font-medium">6 個月</th>
              <th className="font-medium">市盈率</th><th className="font-medium">收入增長</th><th className="font-medium">距高位</th><th className="font-medium">上升空間</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, limit).map((r) => (
              <tr key={r.t} className="cursor-pointer border-b border-ink-100 text-right font-num hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800/50" onClick={() => open(r.t)}>
                <td className="py-1.5 text-left"><span className="font-medium">{r.t}</span> <span className="font-sans text-xs text-ink-500">{r.name}</span></td>
                <td>{bigMoney(r.mcap)}</td><td>{money(r.price)}</td>
                <td className={upDown(r.r6m)}>{pct(r.r6m, 0)}</td>
                <td>{r.pe == null ? '—' : r.pe.toFixed(0)}</td>
                <td>{pct(r.revG, 0)}</td><td>{pct(r.fromHi, 0)}</td><td>{pct(r.upside, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > limit && <div className="mt-3 text-center"><Button onClick={() => setLimit(limit + 50)}>顯示多 50 隻</Button></div>}
      <p className="mt-2 text-xs text-ink-500">撳一行會打開分析頁。唔喺每日數據清單入面嘅股票，分析頁可能只有示範走勢；可以叫 Claude 將佢加入清單。</p>
    </Card>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`rounded-full border px-3 py-1 text-sm transition ${on ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-ink-950' : 'border-ink-200 bg-white hover:border-brand-500 dark:border-ink-700 dark:bg-ink-900'}`}>
      {children}
    </button>
  );
}

export default function IdeasPage({ setTicker, go }) {
  const [state, setState] = useState({ loading: true, data: null });
  const [hist, setHist] = useState([]);
  const [horizon, setHorizonState] = useState(() => load('ideasHorizon', 'short'));
  const [sector, setSector] = useState('');
  const [tracked, setTracked] = useState(() => load('tracked', []));
  useEffect(() => {
    getJSON(`${BASE}data/screener.json`).then((data) => setState({ loading: false, data })).catch(() => setState({ loading: false, data: null }));
    getJSON(`${BASE}data/picks-history.json`).then((h) => setHist(Array.isArray(h) ? h : [])).catch(() => setHist([]));
  }, []);
  const open = (t) => { setTicker(t); go('analysis'); };
  const setHorizon = (h) => { setHorizonState(h); save('ideasHorizon', h); };

  const data = state.data;
  const byT = useMemo(() => new Map((data?.rows || []).map((r) => [r.t, r])), [data]);
  const H = HORIZONS.find((h) => h.key === horizon) || HORIZONS[0];
  // 舊版數據冇 qual，就用 picks（頭 10 隻）
  const qual = useMemo(() => {
    const src = data?.qual || data?.picks || {};
    return Object.fromEntries(Object.entries(src).map(([k, ts]) => [k, ts.map((t) => byT.get(t)).filter(Boolean)]));
  }, [data, byT]);
  const counts = useMemo(() => {
    const c = {};
    for (const l of Object.values(data?.picks || {})) for (const t of l) c[t] = (c[t] || 0) + 1;
    return c;
  }, [data]);
  const sectors = useMemo(() => {
    const c = {};
    const seen = new Set();
    for (const k of H.lists) for (const r of qual[k] || []) if (!seen.has(r.t)) { seen.add(r.t); c[r.sector] = (c[r.sector] || 0) + 1; }
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [qual, H]);
  const streaks = useStreaks(hist);
  const trackedSet = useMemo(() => new Set(tracked.map((x) => x.t)), [tracked]);
  const spyNow = data?.spy ?? hist[hist.length - 1]?.spy;

  const setTrack = (next) => { setTracked(next); save('tracked', next); };
  const toggleTrack = (r, src) => {
    if (trackedSet.has(r.t)) setTrack(tracked.filter((x) => x.t !== r.t));
    else setTrack([...tracked, { t: r.t, d: data?.date || data?.updated?.slice(0, 10), p: r.price, spy: spyNow ?? null, src }]);
  };

  if (state.loading) return <Card><Loading text="載入緊篩選結果…" /></Card>;
  if (!data) return <Card><EmptyState title="未有篩選數據">每晚美股收市後會自動篩選一次，聽日再嚟睇。</EmptyState></Card>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <H2 sub={`${data.universe} · ${data.count} 隻 · 數據日期：${data.date || data.updated?.slice(0, 10)}`}>潛力觀察</H2>
        <p className="text-sm leading-relaxed text-ink-700 dark:text-ink-200">
          每晚電腦會按公開條件，由{data.universe}篩出值得「研究」嘅股票，分<b>短期</b>同<b>長期</b>兩類，可以再按行業睇。佢哋係<b>觀察名單，唔係推薦</b>：冇人可以保證邊隻會升。
          撳入去睇分析，再睇公司新聞同業績，先決定佢係咪適合你。
        </p>
      </Card>
      <Disclaimer />
      <MyTracking items={tracked} byT={byT} spyNow={spyNow} open={open} remove={(t) => setTrack(tracked.filter((x) => x.t !== t))} />

      <Card>
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="投資時間">
          {HORIZONS.map((h) => (
            <button key={h.key} type="button" role="tab" aria-selected={horizon === h.key} onClick={() => setHorizon(h.key)}
              className={`rounded-xl border p-3 text-left transition ${horizon === h.key ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/30' : 'border-ink-200 hover:border-brand-500 dark:border-ink-700'}`}>
              <div className="text-base font-bold">{h.title}</div>
              <div className="text-xs text-ink-500">{h.sub} · {h.lists.length} 套條件</div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">{H.desc}</p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="行業">
          <Chip on={!sector} onClick={() => setSector('')}>全部行業</Chip>
          {sectors.map(([s, n]) => <Chip key={s || 'none'} on={sector === s} onClick={() => setSector(s)}>{sectorZh(s)} {n}</Chip>)}
          {sector && !sectors.some(([s]) => s === sector) && <Chip on onClick={() => setSector('')}>{sectorZh(sector)} 0</Chip>}
        </div>
      </Card>

      {H.lists.map((k) => (
        <IdeaList key={k} k={k} rows={(qual[k] || []).filter((r) => !sector || r.sector === sector)} counts={counts} streak={streaks[k]}
          open={open} tracked={trackedSet} toggleTrack={toggleTrack} sector={sector} />
      ))}
      <TrackRecord hist={hist} keys={H.lists} byT={byT} spyNow={spyNow} />
      <AllTable rows={data.rows || []} open={open} sector={sector} />
    </div>
  );
}

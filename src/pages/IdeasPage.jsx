// 潛力觀察：每晚由標普 500 按公開條件篩出嚟嘅觀察名單（scripts/update_screener.py）
// 呢頁只係展示篩選結果同條件，唔係推薦。
import { useEffect, useMemo, useState } from 'react';
import { Target, TrendingUp, Rocket, ArrowDownRight, ChevronRight } from 'lucide-react';
import { getJSON } from '../lib/api.js';
import { Card, H2, Loading, EmptyState, Pill, Button, Disclaimer } from '../components/ui.jsx';
import { money, pct, bigMoney, upDown } from '../lib/format.js';

const BASE = import.meta.env.BASE_URL || './';

const recText = (m) => (m == null ? '—' : m <= 1.5 ? '強烈買入' : m <= 2.5 ? '買入' : m <= 3.5 ? '持有' : '沽出');

/** 四套篩選條件：文字要同 scripts/update_screener.py 一致 */
const LISTS = [
  {
    key: 'analyst', icon: Target, title: '分析員睇好、目標價較高',
    rule: '至少 10 個分析員跟蹤、平均評級屬「買入」、平均目標價比現價高 15% 以上，按上升空間排。',
    caveat: '目標價係分析員嘅估計，經常會改，亦經常估錯。佢哋通常偏向樂觀。',
    cols: [['目標價', (r) => money(r.target)], ['上升空間', (r) => <span className="text-up">{pct(r.upside, 0)}</span>], ['評級', (r) => `${recText(r.recMean)}（${r.analysts} 人）`]],
  },
  {
    key: 'momentum', icon: TrendingUp, title: '升勢強勁但未過熱',
    rule: '股價高過 50 日線、50 日線高過 200 日線、RSI 喺 50–70、年化波幅低過 60%，按 6 個月回報排。',
    caveat: '升得耐嘅股票可以突然回調。趨勢跟隨策略要配合止蝕。',
    cols: [['6 個月', (r) => <span className={upDown(r.r6m)}>{pct(r.r6m, 0)}</span>], ['RSI', (r) => r.rsi?.toFixed(0)], ['高過 200 日線', (r) => pct(r.ma200 ? r.price / r.ma200 - 1 : null, 0)]],
  },
  {
    key: 'growth', icon: Rocket, title: '高增長又賺錢',
    rule: '收入按年增長 20% 以上、淨利潤率 10% 以上、有正市盈率，按收入增長排。',
    caveat: '高增長通常已經反映喺股價（市盈率可能好高）。增長一放慢，股價可以跌得好急。',
    cols: [['收入增長', (r) => <span className="text-up">{pct(r.revG, 0)}</span>], ['淨利潤率', (r) => pct(r.margin, 0).replace('+', '')], ['市盈率', (r) => r.pe?.toFixed(1) ?? '—']],
  },
  {
    key: 'pullback', icon: ArrowDownRight, title: '賺錢公司回落中',
    rule: '淨利潤率 15% 以上、收入仍然增長 5% 以上、股價比 52 週高位低 15%–35%，按分析員上升空間排。',
    caveat: '跌咗唔一定係平。股價回落可能有原因（例如業績指引差、行業轉弱），要睇新聞搵原因。',
    cols: [['距 52 週高位', (r) => <span className="text-down">{pct(r.fromHi, 0)}</span>], ['淨利潤率', (r) => pct(r.margin, 0).replace('+', '')], ['上升空間', (r) => pct(r.upside, 0)]],
  },
];

function IdeaList({ list, rows, counts, open }) {
  const Icon = list.icon;
  return (
    <Card>
      <div className="mb-2 flex items-start gap-2">
        <Icon className="mt-1 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{list.title}</h2>
          <p className="text-sm text-ink-600 dark:text-ink-300"><b>條件：</b>{list.rule}</p>
          <p className="text-sm text-amber-700 dark:text-amber-300"><b>要留意：</b>{list.caveat}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-500">今日冇股票符合條件。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs text-ink-500 dark:border-ink-700">
                <th className="py-2 font-medium">股票</th>
                <th className="py-2 text-right font-medium">現價</th>
                {list.cols.map(([h]) => <th key={h} className="py-2 text-right font-medium">{h}</th>)}
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.t} className="cursor-pointer border-b border-ink-100 hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800/50" onClick={() => open(r.t)}>
                  <td className="py-2 pr-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-num font-medium">{r.t}</span>
                      {counts[r.t] > 1 && <Pill status="good">符合 {counts[r.t]} 項</Pill>}
                    </div>
                    <div className="max-w-[220px] truncate text-xs text-ink-500">{r.name}{r.sector ? ` · ${r.sector}` : ''}</div>
                  </td>
                  <td className="py-2 text-right font-num">{money(r.price)}</td>
                  {list.cols.map(([h, f]) => <td key={h} className="py-2 text-right font-num">{f(r)}</td>)}
                  <td className="py-2 text-right"><ChevronRight className="ml-auto h-4 w-4 text-ink-400" aria-label="睇分析" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const SORTS = [['upside', '上升空間'], ['r6m', '6 個月回報'], ['revG', '收入增長'], ['fromHi', '距高位'], ['mcap', '市值']];

function AllTable({ rows, open }) {
  const [sector, setSector] = useState('');
  const [sort, setSort] = useState('mcap');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);
  const sectors = useMemo(() => [...new Set(rows.map((r) => r.sector).filter(Boolean))].sort(), [rows]);
  const list = useMemo(() => rows
    .filter((r) => (!sector || r.sector === sector) && (!q || `${r.t} ${r.name}`.toUpperCase().includes(q.toUpperCase())))
    .sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity)), [rows, sector, sort, q]);
  return (
    <Card>
      <H2 sub={`${list.length} 隻`}>全部篩選數據</H2>
      <div className="mb-3 flex flex-wrap gap-2">
        <label htmlFor="all-q" className="sr-only">搜尋</label>
        <input id="all-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="代號或名稱" className="w-40 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-900" />
        <label htmlFor="all-sector" className="sr-only">行業</label>
        <select id="all-sector" value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-900">
          <option value="">全部行業</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
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

export default function IdeasPage({ setTicker, go }) {
  const [state, setState] = useState({ loading: true, data: null });
  useEffect(() => {
    getJSON(`${BASE}data/screener.json`).then((data) => setState({ loading: false, data })).catch(() => setState({ loading: false, data: null }));
  }, []);
  const open = (t) => { setTicker(t); go('analysis'); };

  const data = state.data;
  const byT = useMemo(() => new Map((data?.rows || []).map((r) => [r.t, r])), [data]);
  const counts = useMemo(() => {
    const c = {};
    for (const l of Object.values(data?.picks || {})) for (const t of l) c[t] = (c[t] || 0) + 1;
    return c;
  }, [data]);

  if (state.loading) return <Card><Loading text="載入緊篩選結果…" /></Card>;
  if (!data) return <Card><EmptyState title="未有篩選數據">每晚美股收市後會自動篩選一次，聽日再嚟睇。</EmptyState></Card>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <H2 sub={`${data.universe} · ${data.count} 隻 · 更新：${data.updated?.slice(0, 10)}`}>潛力觀察</H2>
        <p className="text-sm leading-relaxed text-ink-700 dark:text-ink-200">
          每晚電腦會按下面四套公開條件，由{data.universe}篩出值得「研究」嘅股票。佢哋係<b>觀察名單，唔係推薦</b>：冇人可以保證邊隻會升。
          撳入去睇分析，再睇公司新聞同業績，先決定佢係咪適合你。
        </p>
      </Card>
      <Disclaimer />
      {LISTS.map((l) => (
        <IdeaList key={l.key} list={l} rows={(data.picks?.[l.key] || []).map((t) => byT.get(t)).filter(Boolean)} counts={counts} open={open} />
      ))}
      <AllTable rows={data.rows || []} open={open} />
    </div>
  );
}

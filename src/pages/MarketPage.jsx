// 市場總覽：指數、升跌家數、恐懼貪婪指數、大市貢獻、行業表現、升跌榜
// 數據由 scripts/update_screener.py 每晚計好（public/data/market.json）
import { useEffect, useState } from 'react';
import { Activity, Gauge, BarChart3, Layers, ArrowUpDown, LineChart } from 'lucide-react';
import { getJSON } from '../lib/api.js';
import { Card, H2, Loading, EmptyState, Disclaimer } from '../components/ui.jsx';
import { money, pct, upDown } from '../lib/format.js';

const BASE = import.meta.env.BASE_URL || './';

const SECTOR_ZH = {
  Technology: '科技', 'Communication Services': '通訊及媒體', 'Consumer Cyclical': '非必需消費', 'Consumer Defensive': '必需消費',
  Healthcare: '醫療', 'Financial Services': '金融', Industrials: '工業', Energy: '能源', Utilities: '公用事業', 'Real Estate': '地產', 'Basic Materials': '原材料',
};

function Title({ icon: Icon, children, sub }) {
  return <H2 sub={sub}><span className="inline-flex items-center gap-2"><Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden />{children}</span></H2>;
}

function Hint({ children }) {
  return <p className="mt-3 text-xs leading-relaxed text-ink-500"><b>點睇：</b>{children}</p>;
}

function Spark({ values, up }) {
  if (!values?.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values), w = 120, h = 32;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - lo) / (hi - lo || 1)) * h}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden><polyline points={pts} fill="none" strokeWidth="1.5" className={up ? 'stroke-up' : 'stroke-down'} vectorEffect="non-scaling-stroke" /></svg>;
}

function Indices({ list }) {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {list.map((x) => (
        <div key={x.t} className="w-44 shrink-0 rounded-xl border border-ink-200 p-3 dark:border-ink-700">
          <div className="text-sm font-bold">{x.name}</div>
          <div className={`font-num text-xl ${upDown(x.pct)}`}>{x.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          <div className={`font-num text-xs ${upDown(x.pct)}`}>{x.chg >= 0 ? '+' : ''}{x.chg.toFixed(2)} | {pct(x.pct, 2)}</div>
          <div className="mt-1"><Spark values={x.spark} up={x.spark.at(-1) >= x.spark[0]} /></div>
          <div className="text-[10px] text-ink-400">近 3 個月走勢</div>
        </div>
      ))}
    </div>
  );
}

function Breadth({ b }) {
  const total = b.up + b.flat + b.down || 1;
  return (
    <Card>
      <Title icon={BarChart3}>升跌家數</Title>
      <div className="flex items-baseline justify-around font-num text-2xl">
        <span className="text-up">{b.up}<span className="ml-1 font-sans text-xs text-ink-500">升</span></span>
        <span className="text-ink-500">{b.flat}<span className="ml-1 font-sans text-xs">平</span></span>
        <span className="text-down">{b.down}<span className="ml-1 font-sans text-xs text-ink-500">跌</span></span>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full">
        <div className="bg-up" style={{ width: `${(b.up / total) * 100}%` }} />
        <div className="bg-ink-300 dark:bg-ink-600" style={{ width: `${(b.flat / total) * 100}%` }} />
        <div className="bg-down" style={{ width: `${(b.down / total) * 100}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-ink-50 p-2 dark:bg-ink-800/60"><dt className="text-xs text-ink-500">高過 50 日線</dt><dd className="font-num text-lg">{pct(b.above50, 0).replace('+', '')}</dd></div>
        <div className="rounded-lg bg-ink-50 p-2 dark:bg-ink-800/60"><dt className="text-xs text-ink-500">高過 200 日線</dt><dd className="font-num text-lg">{pct(b.above200, 0).replace('+', '')}</dd></div>
        <div className="rounded-lg bg-ink-50 p-2 dark:bg-ink-800/60"><dt className="text-xs text-ink-500">接近一年高位</dt><dd className="font-num text-lg text-up">{b.highs}</dd></div>
        <div className="rounded-lg bg-ink-50 p-2 dark:bg-ink-800/60"><dt className="text-xs text-ink-500">接近一年低位</dt><dd className="font-num text-lg text-down">{b.lows}</dd></div>
      </dl>
      <Hint>標普 500 成份股入面，有幾多隻升、幾多隻跌。指數升但大部分股票跌，代表只係幾隻大股撐起，升勢唔夠健康。</Hint>
    </Card>
  );
}

const FG_COLOR = (s) => (s < 25 ? 'text-red-600 dark:text-red-400' : s < 45 ? 'text-orange-600 dark:text-orange-400' : s <= 55 ? 'text-amber-600 dark:text-amber-300' : s <= 75 ? 'text-lime-600 dark:text-lime-400' : 'text-green-600 dark:text-green-400');

function FearGreed({ fg }) {
  return (
    <Card>
      <Title icon={Gauge} sub="自製簡化版">恐懼貪婪指數</Title>
      <div className="flex items-baseline gap-2">
        <span className={`font-num text-4xl font-bold ${FG_COLOR(fg.score)}`}>{fg.score}</span>
        <span className="text-sm text-ink-500">/ 100</span>
        <span className={`text-lg font-bold ${FG_COLOR(fg.score)}`}>{fg.label}</span>
      </div>
      <div className="relative mt-3 h-2.5 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-green-500">
        <span className="absolute -top-1 w-1.5 -translate-x-1/2 rounded bg-ink-900 dark:bg-white" style={{ left: `${fg.score}%`, height: '18px' }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-500"><span>極度恐懼</span><span>中性</span><span>極度貪婪</span></div>
      <ul className="mt-4 space-y-2">
        {fg.parts.map((p) => (
          <li key={p.key}>
            <div className="flex justify-between text-xs"><span className="font-medium">{p.label}</span><span className="font-num">{p.score}</span></div>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700"><div className="h-full rounded-full bg-brand-500" style={{ width: `${p.score}%` }} /></div>
            <div className="mt-0.5 text-[11px] text-ink-500">{p.text}</div>
          </li>
        ))}
      </ul>
      <Hint>大家好驚嘅時候（恐懼）股價通常已經跌咗唔少；大家好貪心嘅時候要小心追高。股神巴菲特話：「人哋貪婪我恐懼，人哋恐懼我貪婪。」呢個指數係我哋用 5 樣數據自己計，同 CNN 嘅版本唔同。</Hint>
    </Card>
  );
}

function Row({ t, name, right, open, sub }) {
  return (
    <li>
      <button type="button" onClick={() => open(t)} className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-ink-50 dark:hover:bg-ink-800/60">
        <span className="min-w-0"><span className="font-num font-medium">{t}</span> <span className="truncate text-xs text-ink-500">{name}</span>{sub}</span>
        <span className="shrink-0 font-num text-sm">{right}</span>
      </button>
    </li>
  );
}

function Contrib({ c, open }) {
  return (
    <Card>
      <Title icon={Activity} sub="大約數，單位：指數點">大市貢獻</Title>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-bold text-up">● 推高大市</h3>
          <ul>{c.pos.map((x) => <Row key={x.t} t={x.t} name={x.name} open={open} right={<span className="text-up">+{x.pts?.toFixed(2)}<span className="ml-1 text-xs text-ink-500">({pct(x.pct, 1)})</span></span>} />)}</ul>
          {!c.pos.length && <p className="text-sm text-ink-500">今日冇。</p>}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-bold text-down">● 拖低大市</h3>
          <ul>{c.neg.map((x) => <Row key={x.t} t={x.t} name={x.name} open={open} right={<span className="text-down">{x.pts?.toFixed(2)}<span className="ml-1 text-xs text-ink-500">({pct(x.pct, 1)})</span></span>} />)}</ul>
          {!c.neg.length && <p className="text-sm text-ink-500">今日冇。</p>}
        </div>
      </div>
      <Hint>標普 500 係按市值加權，所以 NVDA、AAPL、MSFT 呢啲超大公司郁少少，對指數嘅影響都大過細公司升一倍。睇呢度就知今日大市係邊幾隻帶動。</Hint>
    </Card>
  );
}

function Sectors({ list }) {
  const max = Math.max(...list.map((x) => Math.abs(x.r1d)), 0.001);
  return (
    <Card>
      <Title icon={Layers} sub="按市值加權">行業表現</Title>
      <ul className="space-y-1.5">
        {list.map((x) => (
          <li key={x.sector} className="grid grid-cols-[6.5rem_minmax(0,1fr)_4rem_4.5rem] items-center gap-2 text-sm">
            <span className="truncate">{SECTOR_ZH[x.sector] || x.sector}</span>
            <span className="relative h-2.5">
              <span className="absolute left-1/2 top-0 h-full w-px bg-ink-300 dark:bg-ink-600" />
              <span className={`absolute top-0 h-full rounded ${x.r1d >= 0 ? 'bg-up' : 'bg-down'}`} style={x.r1d >= 0 ? { left: '50%', width: `${(x.r1d / max) * 50}%` } : { right: '50%', width: `${(-x.r1d / max) * 50}%` }} />
            </span>
            <span className={`text-right font-num ${upDown(x.r1d)}`}>{pct(x.r1d, 2)}</span>
            <span className={`text-right font-num text-xs ${upDown(x.r1m)}`}>月 {pct(x.r1m, 1)}</span>
          </li>
        ))}
      </ul>
      <Hint>資金會喺唔同行業之間流動（叫「板塊輪動」）。如果科技跌但公用事業、必需消費升，通常代表市場轉趨保守。</Hint>
    </Card>
  );
}

function Movers({ gainers, losers, open }) {
  const list = (arr) => <ul>{arr.map((x) => <Row key={x.t} t={x.t} name={x.name} open={open} right={<><span className="mr-2 text-ink-500">{money(x.price)}</span><span className={upDown(x.pct)}>{pct(x.pct, 1)}</span></>} />)}</ul>;
  return (
    <Card>
      <Title icon={ArrowUpDown}>標普 500 升跌榜</Title>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><h3 className="mb-1 text-sm font-bold text-up">升幅最大</h3>{list(gainers)}</div>
        <div><h3 className="mb-1 text-sm font-bold text-down">跌幅最大</h3>{list(losers)}</div>
      </div>
      <Hint>一日大升大跌通常因為業績、新聞或者評級改變。撳入去睇分析，再搜尋新聞搵原因，唔好單靠升跌決定買賣。</Hint>
    </Card>
  );
}

export default function MarketPage({ setTicker, go }) {
  const [state, setState] = useState({ loading: true, m: null });
  useEffect(() => {
    getJSON(`${BASE}data/market.json`).then((m) => setState({ loading: false, m })).catch(() => setState({ loading: false, m: null }));
  }, []);
  const open = (t) => { setTicker(t); go('analysis'); };

  if (state.loading) return <Card><Loading text="載入緊市場數據…" /></Card>;
  const m = state.m;
  if (!m) return <Card><EmptyState title="未有市場數據">每晚美股收市後會自動更新一次，聽日再嚟睇。</EmptyState></Card>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Title icon={LineChart} sub={`數據日期：${m.date}（美國收市）`}>市場總覽</Title>
        <Indices list={m.indices} />
        <Hint>標普 500 代表美國 500 間大公司，最常用嚟代表「大市」；納斯達克以科技股為主；VIX 越高代表市場越驚（VIX 升通常係壞消息）。</Hint>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <FearGreed fg={m.fearGreed} />
        <Breadth b={m.breadth} />
      </div>
      <Contrib c={m.contrib} open={open} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Sectors list={m.sectors} />
        <Movers gainers={m.gainers} losers={m.losers} open={open} />
      </div>
      <Disclaimer compact />
    </div>
  );
}

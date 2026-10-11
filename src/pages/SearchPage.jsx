// 搜尋股票：輸入代號 → 公司資料、現價、走勢圖、主要財務數據
import { useEffect, useMemo, useState } from 'react';
import { getIndex } from '../lib/api.js';
import { ArrowRight, Search, Star } from 'lucide-react';
import { useStock } from '../lib/useStock.js';
import { sma } from '../lib/indicators.js';
import { bigMoney, money, pct } from '../lib/format.js';
import { POPULAR_GROUPS, SNAPSHOT_TICKERS } from '../content/companies.js';
import { PriceChart, Legend, MA_COLORS } from '../components/Charts.jsx';
import StockHeader from '../components/StockHeader.jsx';
import EtfInfo from '../components/EtfInfo.jsx';
import TradingViewChart from '../components/TradingViewChart.jsx';
import { Card, H2, Button, Loading, ErrorState, EmptyState, RangeTabs, RANGES, MockPriceBanner, Disclaimer } from '../components/ui.jsx';

export function TickerInput({ onSubmit, placeholder = '輸入美股代號，例如 AAPL、TSLA、NVDA', autoFocus }) {
  const [v, setV] = useState('');
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onSubmit(v.trim().toUpperCase()); setV(''); } }}>
      <label htmlFor="ticker-input" className="sr-only">股票代號</label>
      <input id="ticker-input" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off"
        list="ticker-list" className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 font-num uppercase placeholder:font-sans placeholder:normal-case focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900" />
      <datalist id="ticker-list">{SNAPSHOT_TICKERS.map((t) => <option key={t} value={t} />)}</datalist>
      <Button type="submit" variant="primary"><Search className="h-4 w-4" />搜尋</Button>
    </form>
  );
}

/** 主要財務數字（只列數字＋一句解釋；詳細評語喺「分析」頁） */
function KeyStats({ data }) {
  const f = data.fund, p = data.prices.c;
  const hi = Math.max(...p.slice(-252)), lo = Math.min(...p.slice(-252));
  const stats = [
    ['52 週範圍', `${money(lo)} – ${money(hi)}`, '過去一年最低同最高收市價'],
    ...(f ? [
      ['市值', bigMoney(f.marketCap), '成間公司值幾多錢'],
      ['市盈率 P/E', f.pe == null ? '—' : f.pe < 0 ? '虧損' : f.pe.toFixed(1), '股價係盈利嘅幾多倍'],
      ['每股盈利 EPS', money(f.eps), '每股過去一年賺幾多'],
      ['收入增長', pct(f.revenueGrowth), '生意額比一年前多咗幾多'],
      ['淨利潤率', pct(f.profitMargin), '每賣 $100 淨賺幾多'],
      ['股息率', f.dividendYield ? pct(f.dividendYield, 2).replace('+', '') : '冇派息', '每年派息佔股價幾多'],
      ['Beta', f.beta == null ? '—' : f.beta.toFixed(2), '跟大市郁嘅程度'],
    ] : []),
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map(([k, v, hint]) => (
        <div key={k} className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
          <div className="text-xs text-ink-500 dark:text-ink-400">{k}</div>
          <div className="font-num text-base">{v}</div>
          <div className="text-[11px] text-ink-400">{hint}</div>
        </div>
      ))}
      {data.fundSource === 'none' && <p className="col-span-full text-sm text-ink-500">市值、市盈率等財務數字要喺「設定」加免費 API key 先會顯示。</p>}
      {data.fundSource === 'etf' && <div className="col-span-full"><EtfInfo etf={data.etf} /></div>}
    </div>
  );
}

export default function SearchPage({ ticker, setTicker, favorites, toggleFav, go }) {
  const { loading, error, data, retry } = useStock(ticker);
  const [bars, setBars] = useState(252);
  // 熱門清單只顯示有內置數據嘅股票，免得撳落去得個示範走勢
  const [available, setAvailable] = useState(null);
  useEffect(() => { getIndex().then((i) => setAvailable(new Set((i.tickers || []).map((x) => x.t)))); }, []);
  const mas = useMemo(() => (data ? [50, 200].map((n) => ({ n, values: sma(data.prices.c, n) })) : []), [data]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <TickerInput onSubmit={setTicker} />
        <div className="mt-4 flex flex-col gap-3">
          {favorites.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1 text-xs text-ink-500"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />我嘅收藏</div>
              <div className="flex flex-wrap gap-1.5">{favorites.map((t) => <Chip key={t} t={t} active={t === ticker} onClick={() => setTicker(t)} />)}</div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POPULAR_GROUPS.map(([label, all]) => [label, available ? all.filter((t) => available.has(t)) : all]).filter(([, list]) => list.length).map(([label, list]) => (
              <div key={label}>
                <div className="mb-1.5 text-xs text-ink-500">{label}</div>
                <div className="flex flex-wrap gap-1.5">{list.map((t) => <Chip key={t} t={t} active={t === ticker} onClick={() => setTicker(t)} />)}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {!ticker && (
        <Card><EmptyState title="揀一隻股票開始">喺上面輸入代號，或者撳一個熱門股票。內置咗幾十隻熱門美股同 ETF 嘅真實股價同財務數據；其他股票要喺「設定」加免費 API key。</EmptyState></Card>
      )}
      {ticker && loading && <Card><Loading text={`攞緊 ${ticker} 嘅資料…`} /></Card>}
      {ticker && error && <Card><ErrorState message={error} onRetry={retry} /></Card>}

      {data && !loading && (
        <>
          <Card><StockHeader data={data} isFav={favorites.includes(data.ticker)} onToggleFav={() => toggleFav(data.ticker)} /></Card>
          <Card>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <H2>股價走勢</H2>
              <RangeTabs value={bars} onChange={setBars} options={RANGES} />
            </div>
            {data.priceSource === 'mock' && <MockPriceBanner ticker={data.ticker} />}
            <Legend items={[[MA_COLORS[50], '50 日均線'], [MA_COLORS[200], '200 日均線']]} />
            <PriceChart series={data.prices} mas={mas} bars={bars} />
          </Card>
          <Card>
            <H2 sub="可以自己畫線、加指標">TradingView 互動圖表</H2>
            <TradingViewChart ticker={data.ticker} />
          </Card>
          <Card>
            <H2 sub="詳細白話解釋喺「分析」頁">主要數據</H2>
            <KeyStats data={data} />
            <div className="mt-4 flex justify-end">
              <Button variant="primary" onClick={() => go('analysis')}>睇 {data.ticker} 嘅詳細分析<ArrowRight className="h-4 w-4" /></Button>
            </div>
          </Card>
          <Disclaimer compact />
        </>
      )}
    </div>
  );
}

export function Chip({ t, active, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`rounded-lg border px-2.5 py-1 font-num text-sm transition ${active ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-ink-950' : 'border-ink-200 bg-ink-50 hover:border-brand-500 dark:border-ink-700 dark:bg-ink-800'}`}>
      {t}
    </button>
  );
}

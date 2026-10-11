// 比較 2–3 隻股票：同一起點當 100，睇邊隻升得多；再並排比較主要數據
import { useEffect, useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { getStock, getMarket } from '../lib/api.js';
import { technical, fundamental, verdict } from '../lib/analysis.js';
import { CompareChart } from '../components/Charts.jsx';
import { Card, H2, Button, Loading, ErrorState, EmptyState, RangeTabs, Disclaimer, Pill, SourceBadge } from '../components/ui.jsx';
import { money, pct, upDown } from '../lib/format.js';
import { load, save } from '../lib/storage.js';

const COLORS = ['#0ea5e9', '#f59e0b', '#a855f7'];

export default function ComparePage({ setTicker, go }) {
  const [tickers, setTickers] = useState(() => load('compare', ['NVDA', 'MSFT', 'VTI']));
  const [input, setInput] = useState('');
  const [bars, setBars] = useState(252);
  const [state, setState] = useState({ loading: true, error: null, rows: [] });

  useEffect(() => { save('compare', tickers); }, [tickers]);

  useEffect(() => {
    let alive = true;
    if (!tickers.length) { setState({ loading: false, error: null, rows: [] }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.all([getMarket(), ...tickers.map((t) => getStock(t).catch((e) => ({ ticker: t, failed: e.message })))])
      .then(([market, ...list]) => {
        if (!alive) return;
        const rows = list.map((d) => {
          if (d.failed) return d;
          const tech = technical(d.prices, market);
          const fund = d.fund ? fundamental(d.fund) : null;
          const v = verdict(tech, fund, { fundIsReal: ['finnhub', 'alphavantage', 'snapshot-fund'].includes(d.fundSource), isEtf: d.fundSource === 'etf' });
          return { ...d, tech, fundA: fund, v };
        });
        setState({ loading: false, error: null, rows });
      })
      .catch((e) => alive && setState({ loading: false, error: e.message, rows: [] }));
    return () => { alive = false; };
  }, [tickers]);

  const ok = useMemo(() => state.rows.filter((r) => !r.failed), [state.rows]);

  // 由共同起始日開始，將每隻嘅收市價換算成「起點 = 100」
  const lines = useMemo(() => {
    if (!ok.length) return [];
    const sets = ok.map((r) => new Set(r.prices.d));
    const common = ok[0].prices.d.filter((d) => sets.every((s) => s.has(d)));
    const dates = common.slice(-bars);
    if (dates.length < 2) return [];
    return ok.map((r, i) => {
      const idx = new Map(r.prices.d.map((d, j) => [d, j]));
      const base = r.prices.c[idx.get(dates[0])];
      return { label: r.ticker, color: COLORS[i], points: dates.map((d) => ({ time: d, value: +((r.prices.c[idx.get(d)] / base) * 100).toFixed(2) })) };
    });
  }, [ok, bars]);

  const add = (e) => {
    e.preventDefault();
    const t = input.trim().toUpperCase();
    if (t && !tickers.includes(t) && tickers.length < 3) setTickers([...tickers, t]);
    setInput('');
  };

  const rowsSpec = [
    ['現價', (r) => money(r.quote.price)],
    ['1 個月', (r) => <span className={upDown(r.tech.r1m)}>{pct(r.tech.r1m)}</span>],
    ['1 年', (r) => <span className={upDown(r.tech.r1y)}>{pct(r.tech.r1y)}</span>],
    ['年化波幅', (r) => (r.tech.vol == null ? '—' : `${(r.tech.vol * 100).toFixed(0)}%`)],
    ['最大跌幅（3 年）', (r) => pct(r.tech.mdd, 0)],
    ['RSI', (r) => (r.tech.rsi == null ? '—' : r.tech.rsi.toFixed(0))],
    ['市盈率', (r) => (r.fundSource === 'etf' ? 'ETF' : r.fund?.pe == null ? '—' : r.fund.pe < 0 ? '虧損' : r.fund.pe.toFixed(1))],
    ['收入增長', (r) => (r.fundSource === 'etf' ? 'ETF' : pct(r.fund?.revenueGrowth))],
    ['技術面分數', (r) => r.tech.score],
    ['綜合看法', (r) => <Pill status={r.v.level === 'consider' ? 'good' : r.v.level === 'risky' ? 'bad' : 'mid'}>{r.v.label}</Pill>],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <H2 sub="最多 3 隻">揀股票比較</H2>
        <div className="flex flex-wrap items-center gap-2">
          {tickers.map((t, i) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-num text-sm" style={{ borderColor: COLORS[i] }}>
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />{t}
              <button type="button" aria-label={`移除 ${t}`} onClick={() => setTickers(tickers.filter((x) => x !== t))}><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
          {tickers.length < 3 && (
            <form onSubmit={add} className="flex gap-1.5">
              <label htmlFor="cmp-input" className="sr-only">加股票</label>
              <input id="cmp-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="代號" className="w-24 rounded-lg border border-ink-200 bg-white px-2 py-1 font-num text-sm uppercase dark:border-ink-700 dark:bg-ink-900" />
              <Button type="submit" className="!px-2 !py-1"><Plus className="h-4 w-4" />加</Button>
            </form>
          )}
        </div>
      </Card>

      {state.loading && <Card><Loading text="比較緊…" /></Card>}
      {state.error && <Card><ErrorState message={state.error} /></Card>}
      {!state.loading && tickers.length === 0 && <Card><EmptyState title="未有股票">加 2 至 3 隻股票，例如 NVDA、AMD、SOXX。</EmptyState></Card>}

      {!state.loading && ok.length > 0 && (
        <>
          <Card>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <H2 sub="起點 = 100">表現比較</H2>
              <RangeTabs value={bars} onChange={setBars} options={[['3M', 63], ['6M', 126], ['1Y', 252], ['3Y', 756]]} />
            </div>
            <CompareChart lines={lines} />
            <p className="mt-2 text-sm text-ink-500">例如線去到 150，即係期初放 $100，而家值 $150。</p>
            {ok.some((r) => r.priceSource === 'mock') && <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">注意：有股票用緊示範股價，比較結果唔係真實。</p>}
          </Card>
          <Card>
            <H2>數據並排</H2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-ink-200 dark:border-ink-700">
                    <th className="py-2 text-left font-medium text-ink-500">項目</th>
                    {ok.map((r, i) => (
                      <th key={r.ticker} className="py-2 text-right">
                        <button type="button" className="font-num underline-offset-2 hover:underline" style={{ color: COLORS[tickers.indexOf(r.ticker)] ?? COLORS[i] }} onClick={() => { setTicker(r.ticker); go('analysis'); }}>{r.ticker}</button>
                        {r.priceSource === 'mock' && <div><SourceBadge label="示範股價" mock /></div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowsSpec.map(([label, fn]) => (
                    <tr key={label} className="border-b border-ink-100 dark:border-ink-800">
                      <td className="py-2 text-ink-600 dark:text-ink-300">{label}</td>
                      {ok.map((r) => <td key={r.ticker} className="py-2 text-right font-num">{fn(r)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {state.rows.filter((r) => r.failed).map((r) => <Card key={r.ticker}><ErrorState message={`${r.ticker}：${r.failed}`} /></Card>)}
      <Disclaimer compact />
    </div>
  );
}

// 分析：綜合結論（相對值得考慮 / 中性 / 風險較高）+ 技術分析 + 基本分析
import { useMemo, useState } from 'react';
import { ShieldAlert, ThumbsUp, Scale, BarChart3 } from 'lucide-react';
import { useStock } from '../lib/useStock.js';
import { technical, fundamental, verdict } from '../lib/analysis.js';
import { mockFundamentals } from '../lib/mock.js';
import { PriceChart, RsiChart, MacdChart, Legend, MA_COLORS } from '../components/Charts.jsx';
import StockHeader from '../components/StockHeader.jsx';
import EtfInfo from '../components/EtfInfo.jsx';
import TradingViewChart from '../components/TradingViewChart.jsx';
import { TickerInput } from './SearchPage.jsx';
import { Card, H2, Button, Loading, ErrorState, EmptyState, Disclaimer, Reading, RangeTabs, RANGES, MockPriceBanner, Note } from '../components/ui.jsx';

const LEVEL_STYLE = {
  consider: { cls: 'border-green-500 bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-300', Icon: ThumbsUp },
  neutral: { cls: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', Icon: Scale },
  risky: { cls: 'border-red-500 bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', Icon: ShieldAlert },
};

function ScoreBar({ label, value, max }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span>{label}</span><span className="font-num">{value} / {max}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(value / max) * 100}%` }} /></div>
    </div>
  );
}

function FundBlock({ fund }) {
  return (
    <>
      <div className="mb-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreBar label="估值" value={fund.parts.valuation[0]} max={30} />
        <ScoreBar label="增長" value={fund.parts.growth[0]} max={25} />
        <ScoreBar label="賺錢能力" value={fund.parts.profit[0]} max={25} />
        <ScoreBar label="財務穩健" value={fund.parts.debt[0]} max={20} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{fund.items.map((it) => <Reading key={it.key} item={it} />)}</div>
    </>
  );
}

export function useAnalysis(data, market) {
  return useMemo(() => {
    if (!data) return null;
    const tech = technical(data.prices, market);
    const fund = data.fund ? fundamental(data.fund) : null;
    const v = verdict(tech, fund, { fundIsReal: ['finnhub', 'alphavantage', 'snapshot-fund'].includes(data.fundSource), isEtf: data.fundSource === 'etf' });
    return { tech, fund, v };
  }, [data, market]);
}

export default function AnalysisPage({ ticker, setTicker, favorites, toggleFav }) {
  const { loading, error, data, market, retry } = useStock(ticker);
  const a = useAnalysis(data, market);
  const [bars, setBars] = useState(126);
  const [demo, setDemo] = useState(false);
  const demoFund = useMemo(() => (demo && data ? fundamental(mockFundamentals(data.ticker)) : null), [demo, data]);
  const mas = useMemo(() => (a ? [{ n: 20, values: a.tech.ma20 }, { n: 50, values: a.tech.ma50 }, { n: 200, values: a.tech.ma200 }] : []), [a]);

  if (!ticker) {
    return (
      <Card>
        <EmptyState title="未揀股票" icon={BarChart3}>輸入一個代號，即刻幫你做基本分析同技術分析。</EmptyState>
        <div className="mx-auto max-w-lg"><TickerInput onSubmit={setTicker} /></div>
      </Card>
    );
  }
  if (loading) return <Card><Loading text={`分析緊 ${ticker}…`} /></Card>;
  if (error) return <Card><ErrorState message={error} onRetry={retry} /></Card>;
  if (!data || !a) return null;

  const { tech, fund, v } = a;
  const st = LEVEL_STYLE[v.level];

  return (
    <div className="flex flex-col gap-4">
      <Card><TickerInput onSubmit={setTicker} placeholder="分析另一隻股票…" /></Card>
      <Card><StockHeader data={data} isFav={favorites.includes(data.ticker)} onToggleFav={() => toggleFav(data.ticker)} /></Card>

      {/* 綜合結論 */}
      <section className={`rounded-2xl border-2 p-4 sm:p-5 ${st.cls}`}>
        <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="text-xs text-ink-500">綜合看法（唔係買賣建議）</div>
            <div className={`flex items-center gap-2 text-2xl font-bold ${st.text}`}><st.Icon className="h-7 w-7" />{v.label}</div>
            <div className="font-num text-sm">綜合分數 {v.score} / 100</div>
            <div className="flex flex-col gap-2">
              <ScoreBar label="技術面" value={tech.score} max={100} />
              {fund && v.usedFund && <ScoreBar label="基本面" value={fund.score} max={100} />}
            </div>
            {!v.usedFund && data.fundSource !== 'etf' && <p className="text-xs text-ink-500">未有真實財務數據，所以結論只計技術面。加 API key 後會計埋基本面。</p>}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <p className="leading-relaxed">{v.summary}</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <h3 className="mb-1 text-sm font-bold text-green-700 dark:text-green-300">支持嘅理由</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">{(v.reasons.length ? v.reasons : ['暫時睇唔到明顯優勢。']).map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-bold text-red-700 dark:text-red-300">要留意嘅風險</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">{(v.risks.length ? v.risks : ['暫時睇唔到明顯風險訊號，但唔代表冇風險。']).map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Disclaimer />

      {/* 技術分析 */}
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <H2>技術分析（睇圖）</H2>
          <RangeTabs value={bars} onChange={setBars} options={RANGES} />
        </div>
            {data.priceSource === 'mock' && <MockPriceBanner ticker={data.ticker} />}
        <Legend items={[[MA_COLORS[20], '20 日線'], [MA_COLORS[50], '50 日線'], [MA_COLORS[200], '200 日線'], ['#15803d', '支持位', true], ['#be123c', '阻力位', true], ['#6b7280', '60 日趨勢線', true]]} />
        <PriceChart series={data.prices} mas={mas} sr={tech.sr} trend={tech.trend} bars={bars} height={380} />
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div><p className="text-xs text-ink-500">RSI（14 日）</p><RsiChart dates={data.prices.d} values={tech.rsiArr} bars={bars} /></div>
          <div><Legend items={[['#0ea5e9', 'MACD 快線'], ['#f59e0b', '訊號線']]} /><MacdChart dates={data.prices.d} macd={tech.macdArr} bars={bars} /></div>
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-3">
          {Object.entries({ trend: '趨勢', momentum: '動能', risk: '風險（越高越穩）' }).map(([k, label]) => <ScoreBar key={k} label={label} value={tech.parts[k][0]} max={tech.parts[k][1]} />)}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{tech.items.map((it) => <Reading key={it.key} item={it} />)}</div>
      </Card>

      <Card>
        <H2 sub="好似 YouTuber 咁自己畫線、加指標">TradingView 互動圖表</H2>
        <TradingViewChart ticker={data.ticker} exchange={data.exchange} />
      </Card>

      {/* 基本分析 */}
      <Card>
        <H2 sub={demoFund ? '示範數據，唔係真實數字' : undefined}>基本分析（睇公司）</H2>
        {data.fundSource === 'etf' ? (
          <EtfInfo etf={data.etf} />
        ) : data.fundSource === 'none' && !demoFund ? (
          <div className="flex flex-col items-start gap-3">
            <Note>未有呢隻股票嘅真實財務數據。去「設定」加免費 Finnhub 或 Alpha Vantage key，就會見到市盈率、盈利、收入增長等數字同白話解釋。</Note>
            <Button onClick={() => setDemo(true)}>用示範數據睇吓呢部分係點</Button>
          </div>
        ) : (fund || demoFund) ? (
          <>
            {demoFund && <div className="mb-3 rounded-xl bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">以下全部係<b>隨機示範數據</b>，同 {data.ticker} 真實情況無關，只係俾你睇吓畫面點運作。</div>}
            <FundBlock fund={fund || demoFund} />
          </>
        ) : null}
      </Card>

      <Card>
        <H2>評分點計？</H2>
        <div className="grid gap-4 text-sm leading-relaxed text-ink-600 dark:text-ink-300 md:grid-cols-2">
          <p><b>技術面（100 分）：</b>趨勢 40 分（股價同 50／200 日線嘅位置）、動能 30 分（RSI 喺健康範圍、MACD 方向）、風險 30 分（年化波幅越低分越高）。</p>
          <p><b>基本面（100 分）：</b>估值 30 分（市盈率）、增長 25 分（收入增長）、賺錢能力 25 分（淨利潤率）、財務穩健 20 分（負債比率）。</p>
          <p><b>結論：</b>綜合分數 65 分或以上 =「相對值得考慮」；45 分以下，或者波幅極大、曾經跌超過六成、公司蝕緊錢 =「風險較高」；其餘 =「中性」。ETF 因為已經分散風險，額外加 5 分。</p>
          <p><b>限制：</b>規則刻意簡單，方便你明白每一分點嚟。佢睇唔到新聞、管理層、行業前景，亦預測唔到將來。用佢做研究嘅起點，唔好當係答案。</p>
        </div>
      </Card>
    </div>
  );
}

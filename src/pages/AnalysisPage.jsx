// 分析：綜合結論（相對值得考慮 / 中性 / 風險較高）+ 技術分析 + 基本分析
import { useMemo, useState } from 'react';
import { ShieldAlert, ThumbsUp, Scale, BarChart3, Sparkles, Crosshair, Users } from 'lucide-react';
import { useStock } from '../lib/useStock.js';
import { technical, fundamental, verdict, chips, analysts, priceBattle } from '../lib/analysis.js';
import { money, pct } from '../lib/format.js';
import { mockFundamentals } from '../lib/mock.js';
import { PriceChart, RsiChart, MacdChart, Legend, MA_COLORS } from '../components/Charts.jsx';
import StockHeader from '../components/StockHeader.jsx';
import EtfInfo from '../components/EtfInfo.jsx';
import TradingViewChart from '../components/TradingViewChart.jsx';
import { TickerInput } from './SearchPage.jsx';
import { Card, H2, Button, Loading, ErrorState, EmptyState, Disclaimer, Reading, RangeTabs, RANGES, MockPriceBanner, Note, Pill } from '../components/ui.jsx';

const LEVEL_STYLE = {
  consider: { cls: 'border-green-500 bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-300', ring: 'stroke-green-500', Icon: ThumbsUp },
  neutral: { cls: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', ring: 'stroke-amber-500', Icon: Scale },
  risky: { cls: 'border-red-500 bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', ring: 'stroke-red-500', Icon: ShieldAlert },
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
    const chip = data.priceSource === 'mock' ? null : chips(data.street);
    const analyst = data.priceSource === 'mock' ? null : analysts(data.street, tech.price);
    const v = verdict(tech, fund, { fundIsReal: ['finnhub', 'alphavantage', 'snapshot-fund'].includes(data.fundSource), isEtf: data.fundSource === 'etf', chip, analyst });
    return { tech, fund, chip, analyst, v, battle: priceBattle(tech) };
  }, [data, market]);
}

/** 圓形分數環 */
function ScoreRing({ score, cls }) {
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-ink-200 dark:stroke-ink-700" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" className={cls} strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-num text-3xl font-bold">{score}</span>
        <span className="text-[11px] text-ink-500">/ 100</span>
      </div>
    </div>
  );
}

const SUB_HINT = {
  tech: '趨勢、動能、波幅',
  fund: '估值、增長、利潤、負債',
  chip: '機構持股、沽空、高層買賣',
  analyst: '評級、目標價',
};

function SubCard({ sub }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-700 dark:bg-ink-900/60">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{sub.label}</span>
        {sub.tag ? <Pill status={sub.tag.status}>{sub.tag.text}</Pill> : <Pill status="na">冇數據</Pill>}
      </div>
      <div className="font-num text-xl">{sub.score ?? '—'}<span className="text-xs text-ink-500"> / 100</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700"><div className="h-full rounded-full bg-brand-500" style={{ width: `${sub.score ?? 0}%` }} /></div>
      <div className="text-[11px] text-ink-500">{SUB_HINT[sub.key]}</div>
    </div>
  );
}

const BATTLE_STATE = { 接近支撐: 'mid', 接近阻力: 'mid', 區間整理: 'info', 突破新高: 'good', 跌穿支撐: 'bad' };

/** 價格攻防：支持位、阻力位、距離同三個情境 */
function PriceBattle({ b, isMock }) {
  const [sc, setSc] = useState('hold');
  const levels = [b.s2, b.s1, b.price, b.r1, b.r2].filter((x) => x != null);
  const lo = Math.min(...levels) * 0.99, hi = Math.max(...levels) * 1.01;
  const pos = (x) => `${((x - lo) / (hi - lo)) * 100}%`;
  const Level = ({ label, value, dist, cls }) => (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="text-xs text-ink-500">{label}</span>
      <span className={`font-num text-lg font-bold ${cls}`}>{value != null ? money(value) : '—'}</span>
      <span className="font-num text-[11px] text-ink-500">{dist != null ? `距離 ${pct(dist, 1)}` : ''}</span>
    </div>
  );
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Crosshair className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden />價格攻防</h2>
        <div className="flex items-center gap-2 text-sm"><Pill status={BATTLE_STATE[b.state]}>{b.state}</Pill><span className="font-num">現價 {money(b.price)}</span></div>
      </div>
      {isMock && <MockPriceBanner ticker="呢隻股票" />}
      <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">{b.stateText}</p>
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
        <Level label="主要支撐" value={b.s1} dist={b.dS} cls="text-up" />
        <Level label="次要支撐" value={b.s2} dist={b.s2 ? b.s2 / b.price - 1 : null} cls="" />
        <Level label="主要阻力" value={b.r1} dist={b.dR} cls="text-down" />
      </div>
      {levels.length > 1 && (
        <div className="relative mx-2 mb-1 mt-6 h-1.5 rounded-full bg-gradient-to-r from-green-400/60 via-ink-300 to-red-400/60 dark:via-ink-600" aria-hidden>
          {[b.s2, b.s1].filter(Boolean).map((x) => <span key={x} className="absolute -top-1 h-3.5 w-0.5 bg-green-600" style={{ left: pos(x) }} />)}
          {[b.r1, b.r2].filter(Boolean).map((x) => <span key={x} className="absolute -top-1 h-3.5 w-0.5 bg-red-600" style={{ left: pos(x) }} />)}
          <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded bg-ink-900 px-1.5 py-0.5 font-num text-[11px] text-white dark:bg-ink-100 dark:text-ink-900" style={{ left: pos(b.price) }}>現價</span>
          <span className="absolute -top-1.5 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-brand-600 dark:border-ink-900" style={{ left: pos(b.price), height: '18px' }} />
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="情境">
        {b.scenarios.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={sc === x.key} onClick={() => setSc(x.key)}
            className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${sc === x.key ? 'border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-100' : 'border-ink-200 hover:border-brand-500 dark:border-ink-700'}`}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed">{b.scenarios.find((x) => x.key === sc)?.text}</p>
      <p className="mt-2 text-xs text-ink-500">支持位同阻力位由近 6 個月嘅高低位自動計出，只係參考，唔係預測。情境只係講解常見睇法，唔係買賣建議。</p>
    </Card>
  );
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

  const { tech, fund, chip, analyst, v } = a;
  const st = LEVEL_STYLE[v.level];

  return (
    <div className="flex flex-col gap-4">
      <Card><TickerInput onSubmit={setTicker} placeholder="分析另一隻股票…" /></Card>
      <Card><StockHeader data={data} isFav={favorites.includes(data.ticker)} onToggleFav={() => toggleFav(data.ticker)} /></Card>

      {/* 決策導航：綜合分數 + 一句總結 + 四個分項 */}
      <section className={`rounded-2xl border-2 p-4 sm:p-5 ${st.cls}`}>
        <div className="flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-ink-200"><Sparkles className="h-4 w-4 text-amber-500" aria-hidden />決策導航<span className="font-normal text-ink-500">（唔係買賣建議）</span></div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <ScoreRing score={v.score} cls={st.ring} />
          <div className="min-w-0 flex-1">
            <div className={`flex items-center gap-2 text-2xl font-bold ${st.text}`}><st.Icon className="h-7 w-7" />{v.label}</div>
            <p className="mt-1 font-medium leading-relaxed">{v.headline}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{v.summary}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{v.subs.map((x) => <SubCard key={x.key} sub={x} />)}</div>
        {!v.usedFund && data.fundSource !== 'etf' && <p className="mt-2 text-xs text-ink-500">未有真實財務數據，所以綜合分數冇計基本面。</p>}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-bold text-green-700 dark:text-green-300">支持嘅理由</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">{(v.reasons.length ? v.reasons : ['暫時睇唔到明顯優勢。']).map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-bold text-red-700 dark:text-red-300">要留意嘅風險</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">{(v.risks.length ? v.risks : ['暫時睇唔到明顯風險訊號，但唔代表冇風險。']).map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        </div>
      </section>
      <PriceBattle b={a.battle} isMock={data.priceSource === 'mock'} />
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

      {data.fundSource !== 'etf' && (
        <Card>
          <H2 sub="美股冇每日法人買賣數據，用呢幾樣代替"><span className="inline-flex items-center gap-2"><Users className="h-5 w-5" aria-hidden />籌碼面同分析員</span></H2>
          {chip || analyst ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[...(chip?.items || []), ...(analyst?.items || [])].map((it) => <Reading key={it.key} item={it} />)}</div>
          ) : (
            <Note>呢隻股票未有籌碼同分析員數據。只有每晚自動更新清單入面嘅股票先有（「搜尋股票」頁嗰啲同潛力觀察名單）。</Note>
          )}
        </Card>
      )}

      <Card>
        <H2>評分點計？</H2>
        <div className="grid gap-4 text-sm leading-relaxed text-ink-600 dark:text-ink-300 md:grid-cols-2">
          <p><b>技術面（100 分）：</b>趨勢 40 分（股價同 50／200 日線嘅位置）、動能 30 分（RSI 喺健康範圍、MACD 方向）、風險 30 分（年化波幅越低分越高）。</p>
          <p><b>基本面（100 分）：</b>估值 30 分（市盈率）、增長 25 分（收入增長）、賺錢能力 25 分（淨利潤率）、財務穩健 20 分（負債比率）。</p>
          <p><b>籌碼面（100 分）：</b>機構持股 30 分（越多越好）、沽空比例 40 分（越少越好，沽空增加會扣分）、公司高層買賣 30 分（淨買入最高分）。</p>
          <p><b>分析員（100 分）：</b>平均評級 60 分（1 分強烈買入 = 滿分）、目標價上升空間 40 分。最少要 3 個分析員先計。</p>
          <p><b>結論：</b>綜合分數係有數據嘅分項平均。65 分或以上 =「相對值得考慮」；45 分以下，或者波幅極大、曾經跌超過六成、公司蝕緊錢 =「風險較高」；其餘 =「中性」。ETF 因為已經分散風險，額外加 5 分。</p>
          <p><b>限制：</b>規則刻意簡單，方便你明白每一分點嚟。佢睇唔到新聞、管理層、行業前景，亦預測唔到將來。用佢做研究嘅起點，唔好當係答案。</p>
        </div>
      </Card>
    </div>
  );
}

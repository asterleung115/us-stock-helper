// 睇圖教學：揀一課 → 一步一步睇解釋同圖 → 最後「試下睇」互動練習
import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, XCircle } from 'lucide-react';
import { LESSONS } from '../content/lessons.js';
import { scenario } from '../lib/mock.js';
import { sma, rsi, macd, supportResistance, trendLine } from '../lib/indicators.js';
import { PriceChart, RsiChart, MacdChart, Legend, MA_COLORS } from '../components/Charts.jsx';
import { Card, Button } from '../components/ui.jsx';
import { load, save } from '../lib/storage.js';

/** 將課程設定變成圖表要用嘅數據 */
function buildChart(cfg) {
  const series = cfg.series || scenario(cfg.kind, cfg.seed, Math.max(260, (cfg.bars || 0) + 60));
  const mas = (cfg.ma || []).map((n) => ({ n, values: sma(series.c, n) }));
  const sr = cfg.sr === true ? supportResistance(series.h, series.l, series.c) : cfg.sr || null;
  const trend = cfg.trend === true ? trendLine(series.c, 60) : cfg.trend || null;
  const markers = cfg.markers || (cfg.markLast ? [{ index: series.c.length - 1, text: series.c.at(-1) >= series.o.at(-1) ? '升' : '跌', color: '#0ea5e9' }] : []);
  return {
    series, mas, sr, trend, markers, bars: cfg.bars, volume: !!cfg.volume,
    rsi: cfg.rsi ? rsi(series.c) : null,
    macd: cfg.macd ? macd(series.c) : null,
  };
}

function LessonChart({ cfg }) {
  const c = useMemo(() => buildChart(cfg), [cfg]);
  const legend = [
    ...c.mas.map((m) => [MA_COLORS[m.n], `${m.n} 日均線`]),
    ...(c.sr ? [['#15803d', '支持位', true], ['#be123c', '阻力位', true]] : []),
    ...(c.trend ? [['#6b7280', '趨勢線', true]] : []),
  ];
  return (
    <div className="flex flex-col gap-2">
      {legend.length > 0 && <Legend items={legend} />}
      <PriceChart series={c.series} mas={c.mas} sr={c.sr} trend={c.trend} markers={c.markers} bars={c.bars} volume={c.volume} height={c.rsi || c.macd ? 260 : 320} />
      {c.rsi && <><p className="text-xs text-ink-500 dark:text-ink-400">RSI（14 日）</p><RsiChart dates={c.series.d} values={c.rsi} bars={c.bars} /></>}
      {c.macd && <><Legend items={[['#0ea5e9', '快線'], ['#f59e0b', '訊號線']]} /><MacdChart dates={c.series.d} macd={c.macd} bars={c.bars} /></>}
      <p className="text-[11px] text-ink-400">教學用示範走勢，唔係真實股票。</p>
    </div>
  );
}

function Quiz({ lesson, onPass }) {
  const [seed, setSeed] = useState(1);
  const [chosen, setChosen] = useState(null);
  const q = useMemo(() => lesson.quiz(seed), [lesson, seed]);
  const right = chosen === q.answer;
  const next = () => { setSeed((s) => s + 1); setChosen(null); };

  return (
    <div className="flex flex-col gap-4">
      <LessonChart cfg={q.chart} />
      <div>
        <p className="mb-3 font-bold">{q.q}</p>
        <div className="flex flex-col gap-2">
          {q.options.map((o, i) => {
            const state = chosen == null ? '' : i === q.answer ? 'border-green-500 bg-green-50 dark:bg-green-950/40' : i === chosen ? 'border-red-500 bg-red-50 dark:bg-red-950/40' : 'opacity-60';
            return (
              <button key={o} type="button" disabled={chosen != null}
                onClick={() => { setChosen(i); if (i === q.answer) onPass(); }}
                className={`rounded-xl border border-ink-200 px-4 py-2.5 text-left text-sm transition hover:border-brand-500 dark:border-ink-700 ${state}`}>
                {o}
              </button>
            );
          })}
        </div>
        {chosen != null && (
          <div className={`mt-3 flex gap-2 rounded-xl p-3 text-sm ${right ? 'bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200' : 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200'}`}>
            {right ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
            <p><b>{right ? '答啱！' : '唔緊要，再睇吓：'}</b>{q.explain}</p>
          </div>
        )}
        <Button className="mt-3" onClick={next}><RefreshCw className="h-4 w-4" />換一題</Button>
      </div>
    </div>
  );
}

export default function LearnPage() {
  const [lessonId, setLessonId] = useState(LESSONS[0].id);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(() => load('lessonsDone', []));
  const lesson = LESSONS.find((l) => l.id === lessonId);
  const total = lesson.steps.length + 1; // 最後一步係練習
  const isQuiz = step === lesson.steps.length;
  const s = lesson.steps[step];

  const choose = (id) => { setLessonId(id); setStep(0); };
  const pass = () => { if (!done.includes(lesson.id)) { const d = [...done, lesson.id]; setDone(d); save('lessonsDone', d); } };
  const idx = LESSONS.findIndex((l) => l.id === lessonId);

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="課程" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        <p className="hidden text-xs text-ink-500 lg:block">已完成 {done.length} / {LESSONS.length} 課</p>
        {LESSONS.map((l, i) => (
          <button key={l.id} type="button" onClick={() => choose(l.id)} aria-current={l.id === lessonId}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${l.id === lessonId ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-ink-200 hover:border-brand-400 dark:border-ink-800'}`}>
            <span className="font-num text-xs text-ink-400">{i + 1}</span>
            <span className="font-medium">{l.title}</span>
            {done.includes(l.id) && <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="已完成" />}
          </button>
        ))}
      </nav>

      <Card className="min-w-0">
        <div className="mb-1 text-xs text-ink-500 dark:text-ink-400">第 {idx + 1} 課 · {lesson.short}</div>
        <h2 className="text-xl font-bold">{lesson.title}</h2>

        {/* 步驟進度 */}
        <div className="my-4 flex gap-1.5" aria-label={`第 ${step + 1} 步，共 ${total} 步`}>
          {Array.from({ length: total }, (_, i) => (
            <button key={i} type="button" onClick={() => setStep(i)} aria-label={i === total - 1 ? '試下睇' : `第 ${i + 1} 步`}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700'}`} />
          ))}
        </div>

        {isQuiz ? (
          <>
            <h3 className="mb-3 text-lg font-bold text-brand-700 dark:text-brand-300">試下睇</h3>
            <Quiz key={lesson.id} lesson={lesson} onPass={pass} />
          </>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-bold">{step + 1}. {s.title}</h3>
              {s.body.map((p) => <p key={p} className="leading-relaxed text-ink-700 dark:text-ink-200">{p}</p>)}
            </div>
            <LessonChart cfg={s.chart} />
          </div>
        )}

        <div className="mt-6 flex justify-between gap-2">
          <Button onClick={() => (step > 0 ? setStep(step - 1) : idx > 0 && choose(LESSONS[idx - 1].id))} disabled={step === 0 && idx === 0}>
            <ChevronLeft className="h-4 w-4" />上一步
          </Button>
          {step < total - 1 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)}>{step === total - 2 ? '去練習' : '下一步'}<ChevronRight className="h-4 w-4" /></Button>
          ) : idx < LESSONS.length - 1 ? (
            <Button variant="primary" onClick={() => choose(LESSONS[idx + 1].id)}>下一課：{LESSONS[idx + 1].title}<ChevronRight className="h-4 w-4" /></Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

// 學習路徑：點樣開始、風險管理、常見錯誤、詞彙表
import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { ROADMAP, RISK_RULES, MISTAKES, GLOSSARY } from '../content/path.js';
import { Card, H2, Disclaimer } from '../components/ui.jsx';
import { load, save } from '../lib/storage.js';

const SECTIONS = [['roadmap', '點樣開始'], ['risk', '風險管理'], ['mistakes', '常見錯誤'], ['glossary', '詞彙表']];

export default function PathPage() {
  const [sec, setSec] = useState('roadmap');
  const [done, setDone] = useState(() => load('roadmapDone', []));
  const [q, setQ] = useState('');
  const toggle = (i) => { const d = done.includes(i) ? done.filter((x) => x !== i) : [...done, i]; setDone(d); save('roadmapDone', d); };
  const terms = GLOSSARY.filter(([zh, en, def]) => !q || `${zh} ${en} ${def}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {SECTIONS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={sec === k} onClick={() => setSec(k)}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${sec === k ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-ink-950' : 'border border-ink-200 dark:border-ink-700'}`}>{label}</button>
        ))}
      </div>

      {sec === 'roadmap' && (
        <Card>
          <H2 sub={`完成 ${done.length} / ${ROADMAP.length}`}>點樣開始投資美股</H2>
          <ol className="flex flex-col gap-3">
            {ROADMAP.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <button type="button" onClick={() => toggle(i)} aria-pressed={done.includes(i)} aria-label={`標記第 ${i + 1} 步完成`} className="mt-0.5 shrink-0">
                  {done.includes(i) ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <Circle className="h-6 w-6 text-ink-300" />}
                </button>
                <div className="min-w-0">
                  <h3 className="font-bold"><span className="mr-1 font-num text-ink-400">{i + 1}.</span>{s.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-ink-500">稅務同開戶規定因地區而異，以上只係一般資訊，請以券商同當地稅務機關資料為準。</p>
        </Card>
      )}

      {sec === 'risk' && (
        <Card>
          <H2>風險管理基本功</H2>
          <div className="grid gap-3 sm:grid-cols-2">
            {RISK_RULES.map((r) => (
              <div key={r.title} className="rounded-xl border border-ink-200 p-4 dark:border-ink-800">
                <h3 className="mb-1 font-bold">{r.title}</h3>
                <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{r.body}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {sec === 'mistakes' && (
        <Card>
          <H2>新手最常犯嘅錯</H2>
          <div className="grid gap-3 sm:grid-cols-2">
            {MISTAKES.map((m) => (
              <div key={m.title} className="rounded-xl bg-red-50 p-4 dark:bg-red-950/30">
                <h3 className="mb-1 font-bold text-red-800 dark:text-red-300">{m.title}</h3>
                <p className="text-sm leading-relaxed text-ink-700 dark:text-ink-200">{m.body}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {sec === 'glossary' && (
        <Card>
          <H2 sub={`${terms.length} 個詞`}>詞彙表</H2>
          <label htmlFor="gloss-q" className="sr-only">搜尋詞彙</label>
          <input id="gloss-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋，例如 市盈率、RSI、ETF"
            className="mb-4 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 dark:border-ink-700 dark:bg-ink-900" />
          <dl className="grid gap-3 md:grid-cols-2">
            {terms.map(([zh, en, def]) => (
              <div key={zh} className="rounded-xl border border-ink-200 p-3 dark:border-ink-800">
                <dt className="font-bold">{zh} <span className="text-xs font-normal text-ink-400">{en}</span></dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{def}</dd>
              </div>
            ))}
          </dl>
          {terms.length === 0 && <p className="py-6 text-center text-sm text-ink-500">搵唔到「{q}」，試吓其他字眼。</p>}
        </Card>
      )}
      <Disclaimer compact />
    </div>
  );
}

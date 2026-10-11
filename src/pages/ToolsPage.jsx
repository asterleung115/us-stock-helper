// 工具：倉位／風險計算機 + 定投複利計算機
import { useState } from 'react';
import { Card, H2, Note } from '../components/ui.jsx';
import { money } from '../lib/format.js';

function Field({ id, label, hint, value, onChange, step = 'any', suffix }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <input id={id} type="number" inputMode="decimal" step={step} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 rounded-xl border border-ink-200 bg-white px-3 py-2 font-num dark:border-ink-700 dark:bg-ink-900" />
        {suffix && <span className="text-ink-500">{suffix}</span>}
      </div>
      {hint && <span className="text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
      <div className="text-xs text-ink-500 dark:text-ink-400">{label}</div>
      <div className={`font-num text-xl ${tone || ''}`}>{value}</div>
    </div>
  );
}

function PositionSize() {
  const [acct, setAcct] = useState('10000');
  const [riskPct, setRiskPct] = useState('1');
  const [entry, setEntry] = useState('100');
  const [stop, setStop] = useState('92');
  const A = +acct, R = +riskPct / 100, E = +entry, S = +stop;
  const valid = A > 0 && R > 0 && E > 0 && S > 0 && S < E;
  const riskAmt = A * R;
  const perShare = E - S;
  const shares = valid ? Math.floor(riskAmt / perShare) : 0;
  const posValue = shares * E;
  const posPct = posValue / A;
  const capped = posValue > A;

  return (
    <Card>
      <H2 sub="限制每筆最多蝕幾多">倉位／風險計算機</H2>
      <p className="mb-4 text-sm text-ink-600 dark:text-ink-300">先決定「呢筆最多肯蝕幾多」，再由止蝕位反推應該買幾多股。咁就算估錯，損失都喺控制之內。</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="ps-acct" label="總投資資金" value={acct} onChange={setAcct} suffix="USD" />
        <Field id="ps-risk" label="每筆最多蝕" value={riskPct} onChange={setRiskPct} suffix="%" hint="新手建議 1–2%" />
        <Field id="ps-entry" label="買入價" value={entry} onChange={setEntry} suffix="USD" />
        <Field id="ps-stop" label="止蝕價" value={stop} onChange={setStop} suffix="USD" hint="跌到呢個價就賣" />
      </div>
      {!valid ? (
        <p className="mt-4 text-sm text-red-600">請填正數，而且止蝕價要低過買入價。</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <Stat label="最多蝕" value={money(riskAmt)} tone="text-down" />
            <Stat label="每股風險" value={`${money(perShare)}（${((perShare / E) * 100).toFixed(1)}%）`} />
            <Stat label="建議買入股數" value={`${shares.toLocaleString()} 股`} tone="text-brand-600 dark:text-brand-300" />
            <Stat label="倉位金額" value={`${money(posValue)}（${(posPct * 100).toFixed(0)}%）`} />
          </div>
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">
            意思：買 {shares.toLocaleString()} 股，如果跌到止蝕價 {money(S)} 賣出，大約蝕 {money(shares * perShare)}，即係總資金嘅 {((shares * perShare / A) * 100).toFixed(1)}%。
          </p>
          {capped && <Note>計出嚟嘅倉位大過你總資金，即係止蝕位太近。實際上最多只可以用總資金買，或者考慮放遠啲止蝕位。</Note>}
          {!capped && posPct > 0.25 && <Note>呢筆佔總資金超過 25%，集中度好高。就算計過風險，都可以考慮買少啲，分散投資。</Note>}
        </>
      )}
    </Card>
  );
}

function Compound() {
  const [monthly, setMonthly] = useState('500');
  const [years, setYears] = useState('20');
  const [rate, setRate] = useState('7');
  const M = +monthly, Y = Math.min(60, Math.max(1, Math.round(+years))), r = +rate / 100 / 12;
  const n = Y * 12;
  const fv = r === 0 ? M * n : M * ((Math.pow(1 + r, n) - 1) / r);
  const invested = M * n;
  // 每 5 年一格，畫一個簡單柱狀圖
  const marks = [];
  for (let y = 5; y <= Y; y += 5) {
    const k = y * 12;
    marks.push({ y, v: r === 0 ? M * k : M * ((Math.pow(1 + r, k) - 1) / r), inv: M * k });
  }
  if (!marks.length || marks.at(-1).y !== Y) marks.push({ y: Y, v: fv, inv: invested });
  const max = Math.max(...marks.map((m) => m.v));

  return (
    <Card>
      <H2 sub="時間係最大嘅朋友">定投複利計算機</H2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="cp-m" label="每月投入" value={monthly} onChange={setMonthly} suffix="USD" />
        <Field id="cp-y" label="年期" value={years} onChange={setYears} suffix="年" step="1" />
        <Field id="cp-r" label="假設每年回報" value={rate} onChange={setRate} suffix="%" hint="美股大市長期平均約 7–10%（未扣通脹），唔保證" />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Stat label="總共投入" value={money(invested)} />
        <Stat label={`${Y} 年後大約值`} value={money(fv)} tone="text-brand-600 dark:text-brand-300" />
        <Stat label="其中回報" value={money(fv - invested)} tone="text-up" />
      </div>
      <div className="mt-4 flex h-40 items-end gap-2" aria-hidden>
        {marks.map((m) => (
          <div key={m.y} className="flex flex-1 flex-col items-center gap-1">
            <div className="relative w-full max-w-[48px] rounded-t-md bg-brand-200 dark:bg-brand-800" style={{ height: `${(m.v / max) * 120}px` }}>
              <div className="absolute bottom-0 w-full rounded-t-md bg-brand-600 dark:bg-brand-400" style={{ height: `${(m.inv / max) * 120}px` }} />
            </div>
            <span className="font-num text-[11px] text-ink-500">{m.y}年</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-500">深色 = 你放入嘅本金；淺色 = 複利滾出嚟嘅回報。實際回報每年都唔同，有啲年仲會蝕。</p>
    </Card>
  );
}

export default function ToolsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PositionSize />
      <Compound />
    </div>
  );
}

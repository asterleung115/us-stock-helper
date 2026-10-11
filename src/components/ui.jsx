// 共用 UI 小元件
import { AlertTriangle, Loader2, Info, SearchX } from 'lucide-react';

export function Card({ className = '', children, ...rest }) {
  return <section className={`rounded-2xl border border-ink-200 bg-white p-4 sm:p-5 dark:border-ink-800 dark:bg-ink-900 ${className}`} {...rest}>{children}</section>;
}

export function H2({ children, sub }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-bold text-ink-900 dark:text-ink-50">{children}</h2>
      {sub && <span className="text-xs text-ink-500 dark:text-ink-400">{sub}</span>}
    </div>
  );
}

const PILL = {
  good: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  mid: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  bad: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  na: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
};
const PILL_TEXT = { good: '正面', mid: '留意', bad: '負面', info: '資料', na: '冇數據' };

export function Pill({ status = 'na', children }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${PILL[status]}`}>{children ?? PILL_TEXT[status]}</span>;
}

export function Button({ variant = 'default', className = '', ...rest }) {
  const v = {
    default: 'border border-ink-200 bg-white hover:border-brand-500 dark:border-ink-700 dark:bg-ink-900',
    primary: 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-ink-950 dark:hover:bg-brand-400',
    ghost: 'hover:bg-ink-100 dark:hover:bg-ink-800',
  }[variant];
  return <button type="button" className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${v} ${className}`} {...rest} />;
}

export function Disclaimer({ compact }) {
  return (
    <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <b>重要提示：</b>呢度所有內容只供學習，<b>唔係投資建議</b>。過去表現唔代表將來，任何股票都可以蝕錢。
        {!compact && '投資前請自己做功課，有需要可以諮詢持牌理財顧問。'}
      </p>
    </div>
  );
}

export function Loading({ text = '載入緊…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-500 dark:text-ink-400" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {text}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden />
      <p className="text-ink-700 dark:text-ink-200">出咗少少問題：{message}</p>
      {onRetry && <Button onClick={onRetry}>再試一次</Button>}
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon = SearchX }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Icon className="h-10 w-10 text-brand-500" aria-hidden />
      <p className="text-base font-bold">{title}</p>
      <div className="max-w-md text-sm text-ink-500 dark:text-ink-400">{children}</div>
    </div>
  );
}

export function Note({ children }) {
  return (
    <div className="flex gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** 數據來源標籤：示範數據用黃色，令用戶一眼睇到 */
export function SourceBadge({ label, mock }) {
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${mock ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'}`}>
      {label}
    </span>
  );
}

/** 範圍按鈕（1M / 3M / 1Y …） */
export function RangeTabs({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="時間範圍">
      {options.map(([label, n]) => (
        <button key={label} type="button" aria-pressed={value === n} onClick={() => onChange(n)}
          className={`rounded-lg px-2.5 py-1 font-num text-xs ${value === n ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900' : 'border border-ink-200 dark:border-ink-700'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
export const RANGES = [['1M', 21], ['3M', 63], ['6M', 126], ['1Y', 252], ['3Y', 756], ['全部', 99999]];

/** 一個讀數格：標題 + 狀態 + 數值 + 白話解釋 */
export function Reading({ item }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-ink-200 p-3 dark:border-ink-800">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{item.label}</h3>
        <Pill status={item.status} />
      </div>
      <div className="font-num text-lg">{item.value}</div>
      <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{item.text}</p>
    </div>
  );
}

/** 示範股價警告：用緊假走勢時喺圖表上面顯示 */
export function MockPriceBanner({ ticker }) {
  return (
    <div className="mb-2 rounded-xl bg-amber-100 p-2.5 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
      呢個係<b>隨機示範走勢</b>，唔係 {ticker} 嘅真實股價。加 Alpha Vantage key（喺自己電腦運行）就會見到真實數據。
    </div>
  );
}

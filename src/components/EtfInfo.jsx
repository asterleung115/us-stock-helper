// ETF 資料：管理費、規模、十大持股（來自每晚更新嘅快照）
import { bigMoney } from '../lib/format.js';

export default function EtfInfo({ etf }) {
  if (!etf) {
    return <p className="text-sm text-ink-500">呢隻係 ETF（一籃子股票），冇單一公司嘅市盈率、盈利等數字。揀 ETF 主要睇：追蹤咩指數、管理費（越低越好）、規模大唔大。</p>;
  }
  const er = etf.expenseRatio;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
          <div className="text-xs text-ink-500 dark:text-ink-400">每年管理費</div>
          <div className="font-num text-base">{er == null ? '—' : `${(er * 100).toFixed(2)}%`}</div>
          <div className="text-[11px] text-ink-400">{er == null ? '' : `每投資 $10,000，一年收大約 $${(er * 10000).toFixed(0)}`}</div>
        </div>
        <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
          <div className="text-xs text-ink-500 dark:text-ink-400">基金規模</div>
          <div className="font-num text-base">{bigMoney(etf.totalAssets)}</div>
          <div className="text-[11px] text-ink-400">規模大，通常買賣差價細、較穩陣</div>
        </div>
        {etf.category && (
          <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
            <div className="text-xs text-ink-500 dark:text-ink-400">類別</div>
            <div className="text-base">{etf.category}</div>
          </div>
        )}
      </div>
      {etf.holdings?.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-bold">十大持股</h3>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {etf.holdings.map((h) => (
              <li key={h.symbol} className="flex justify-between gap-3 border-b border-ink-100 py-1 dark:border-ink-800">
                <span className="min-w-0 truncate"><span className="font-num">{h.symbol}</span> <span className="text-ink-500">{h.name}</span></span>
                <span className="font-num">{h.weight == null ? '—' : `${(h.weight * 100).toFixed(1)}%`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

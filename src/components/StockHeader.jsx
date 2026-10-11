// 股票頂部資料：名稱、代號、現價、升跌、收藏掣、數據來源
import { Star } from 'lucide-react';
import { money, pct, upDown } from '../lib/format.js';
import { SOURCE_LABEL } from '../lib/api.js';
import { SourceBadge, Note } from './ui.jsx';

export default function StockHeader({ data, isFav, onToggleFav }) {
  const { ticker, quote, fund, info, priceSource, fundSource, notes, nextEarnings } = data;
  const name = info?.name || fund?.name || ticker;
  const sector = info?.sector || fund?.sector;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {fund?.logo && <img src={fund.logo} alt="" className="h-11 w-11 rounded-lg bg-white object-contain p-1" onError={(e) => { e.currentTarget.hidden = true; }} />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="font-num text-2xl font-medium">{ticker}</h2>
              <span className="font-bold">{name}</span>
              {sector && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">{sector}</span>}
            </div>
            {(info?.desc || fund?.description) && <p className="mt-1 max-w-3xl text-sm text-ink-600 dark:text-ink-300 line-clamp-3">{info?.desc || fund.description}</p>}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right">
            <div className="font-num text-2xl">{money(quote.price)}</div>
            <div className={`font-num text-sm ${upDown(quote.changePct)}`}>{pct(quote.changePct, 2)} {quote.change != null && `(${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)})`}</div>
            <div className="text-[11px] text-ink-400">{quote.source === 'finnhub' ? '即時報價' : '最後收市'} · {quote.time?.slice(0, 10)}</div>
          </div>
          <button type="button" onClick={onToggleFav} aria-pressed={isFav} aria-label={isFav ? '移除收藏' : '加入收藏'}
            className="rounded-xl border border-ink-200 p-2 hover:border-amber-400 dark:border-ink-700">
            <Star className={`h-5 w-5 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-ink-400'}`} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
        數據來源：
        <SourceBadge label={`股價：${SOURCE_LABEL[priceSource]}`} mock={priceSource === 'mock'} />
        {fundSource && <SourceBadge label={`財務：${SOURCE_LABEL[fundSource]}`} mock={fundSource === 'mock'} />}
        {nextEarnings && (
          <span className="ml-auto rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" title="股價喺業績前後經常大上大落">
            下次業績：{nextEarnings}
          </span>
        )}
      </div>
      {notes.length > 0 && <Note><ul className="list-disc pl-4">{notes.map((n) => <li key={n}>{n}</li>)}</ul></Note>}
    </div>
  );
}

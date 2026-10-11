// 設定：API key、深色模式、清除本機資料
import { useState } from 'react';
import { Monitor, Moon, Sun, KeyRound } from 'lucide-react';
import { Card, H2, Button, Note } from '../components/ui.jsx';
import { useTheme } from '../components/theme.jsx';
import { load, save } from '../lib/storage.js';
import { clearCache } from '../lib/api.js';

export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const saved = load('keys', {});
  const [finnhub, setFinnhub] = useState(saved.finnhub || '');
  const [av, setAv] = useState(saved.alphavantage || '');
  const [msg, setMsg] = useState('');

  const saveKeys = (e) => {
    e.preventDefault();
    save('keys', { finnhub: finnhub.trim(), alphavantage: av.trim() });
    clearCache();
    setMsg('已儲存。下次搜尋股票就會用新 key。');
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <H2>顯示模式</H2>
        <div className="flex flex-wrap gap-2">
          {[['system', '跟系統', Monitor], ['light', '淺色', Sun], ['dark', '深色', Moon]].map(([k, label, Icon]) => (
            <Button key={k} variant={mode === k ? 'primary' : 'default'} onClick={() => setMode(k)} aria-pressed={mode === k}><Icon className="h-4 w-4" />{label}</Button>
          ))}
        </div>
      </Card>

      <Card>
        <H2 sub="可選，免費">數據 API key</H2>
        <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">唔加 key 都用得：33 隻熱門股有內置真實股價（每日快照），財務數字會用示範數據。加咗 key 就可以睇任何美股嘅即時報價同真實財務數字。</p>
        <form onSubmit={saveKeys} className="flex flex-col gap-3">
          <label htmlFor="k-finnhub" className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Finnhub key（即時報價 + 財務數據）</span>
            <input id="k-finnhub" value={finnhub} onChange={(e) => setFinnhub(e.target.value)} autoComplete="off" spellCheck={false}
              className="rounded-xl border border-ink-200 bg-white px-3 py-2 font-num dark:border-ink-700 dark:bg-ink-900" />
            <span className="text-xs text-ink-500">免費申請：<a className="text-brand-600 underline dark:text-brand-300" href="https://finnhub.io/register" target="_blank" rel="noreferrer">finnhub.io/register</a>（每分鐘 60 次）</span>
          </label>
          <label htmlFor="k-av" className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Alpha Vantage key（任何股票最近 100 日股價 + 公司概覽）</span>
            <input id="k-av" value={av} onChange={(e) => setAv(e.target.value)} autoComplete="off" spellCheck={false}
              className="rounded-xl border border-ink-200 bg-white px-3 py-2 font-num dark:border-ink-700 dark:bg-ink-900" />
            <span className="text-xs text-ink-500">免費申請：<a className="text-brand-600 underline dark:text-brand-300" href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noreferrer">alphavantage.co</a>（每日 25 次）</span>
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary"><KeyRound className="h-4 w-4" />儲存</Button>
            {msg && <span className="text-sm text-green-700 dark:text-green-300" role="status">{msg}</span>}
          </div>
        </form>
        <div className="mt-4"><Note>key 只會儲存喺你呢部機嘅瀏覽器（localStorage），唔會傳去其他地方，只會用嚟直接連去 Finnhub／Alpha Vantage。如果你喺 Claude 預覽版入面用，瀏覽器安全設定會封鎖外部連線，要喺自己電腦用 <code>npm run dev</code> 開先用到 API。</Note></div>
      </Card>

      <Card>
        <H2>本機資料</H2>
        <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">收藏、課程進度、API key 都儲存喺呢部機。</p>
        <Button onClick={() => { try { Object.keys(localStorage).filter((k) => k.startsWith('ush:')).forEach((k) => localStorage.removeItem(k)); } catch { /* */ } clearCache(); setMsg(''); setFinnhub(''); setAv(''); window.location.reload(); }}>
          清除全部本機資料
        </Button>
      </Card>
    </div>
  );
}

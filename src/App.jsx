// 主程式：頂部導覽 + 各頁面。用網址 # 記住而家喺邊頁（例如 #analysis），方便分享同返回。
import { useEffect, useState } from 'react';
import { BookOpen, Search, BarChart3, GitCompare, Map, Calculator, Settings, TrendingUp } from 'lucide-react';
import LearnPage from './pages/LearnPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';
import ComparePage from './pages/ComparePage.jsx';
import PathPage from './pages/PathPage.jsx';
import ToolsPage from './pages/ToolsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { load, save } from './lib/storage.js';
import { getIndex } from './lib/api.js';

const TABS = [
  ['learn', '教學', BookOpen],
  ['search', '搜尋股票', Search],
  ['analysis', '分析', BarChart3],
  ['compare', '比較', GitCompare],
  ['path', '學習路徑', Map],
  ['tools', '工具', Calculator],
  ['settings', '設定', Settings],
];
const TAB_IDS = TABS.map((t) => t[0]);
const fromHash = () => { const h = window.location.hash.replace('#', ''); return TAB_IDS.includes(h) ? h : 'learn'; };

export default function App() {
  const [tab, setTab] = useState(fromHash);
  const [ticker, setTickerState] = useState(() => load('ticker', 'NVDA'));
  const [favorites, setFavorites] = useState(() => load('favorites', []));
  const [updated, setUpdated] = useState(null);

  useEffect(() => { getIndex().then((i) => setUpdated(i?.updated || null)); }, []);

  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (id) => {
    setTab(id);
    try { history.replaceState(null, '', `#${id}`); } catch { /* 預覽環境可能唔俾改網址 */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const setTicker = (t) => { setTickerState(t); save('ticker', t); };
  const toggleFav = (t) => {
    const next = favorites.includes(t) ? favorites.filter((x) => x !== t) : [...favorites, t];
    setFavorites(next); save('favorites', next);
  };
  const shared = { ticker, setTicker, favorites, toggleFav, go };

  return (
    <div className="min-h-full bg-ink-50 text-ink-900 dark:bg-ink-950 dark:text-ink-100">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-ink-50/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-2 pt-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-brand-600 dark:text-brand-400" aria-hidden />
            <h1 className="text-lg font-black tracking-tight">美股入門助手</h1>
            <span className="hidden text-sm text-ink-500 sm:inline">由睇圖到分析，一步一步學投資</span>
          </div>
          <nav aria-label="主選單" className="-mx-1 flex gap-1 overflow-x-auto">
            {TABS.map(([id, label, Icon]) => (
              <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); go(id); }} aria-current={tab === id ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${tab === id ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-ink-950' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'}`}>
                <Icon className="h-4 w-4" aria-hidden />{label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {tab === 'learn' && <LearnPage />}
        {tab === 'search' && <SearchPage {...shared} />}
        {tab === 'analysis' && <AnalysisPage {...shared} />}
        {tab === 'compare' && <ComparePage {...shared} />}
        {tab === 'path' && <PathPage />}
        {tab === 'tools' && <ToolsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs leading-relaxed text-ink-500">
        只供學習用途，唔係投資建議。過去表現唔代表將來。內置數據源自 Yahoo Finance（股價已按拆股及股息調整）{updated && `，最後更新：${updated.slice(0, 10)}`}。
      </footer>
    </div>
  );
}

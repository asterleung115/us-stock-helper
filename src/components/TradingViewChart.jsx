// TradingView 免費「進階圖表」小工具：可以自己畫線、加指標、轉時間週期
// 文件：https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTheme } from './theme.jsx';
import { tvSymbol } from './TVWidget.jsx';

export default function TradingViewChart({ ticker, exchange, height = 560 }) {
  const ref = useRef(null);
  const { dark } = useTheme();
  const [failed, setFailed] = useState(false);
  const symbol = tvSymbol(ticker, exchange);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    setFailed(false);
    box.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.async = true;
    s.type = 'text/javascript';
    s.onerror = () => setFailed(true);
    s.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'America/New_York',
      theme: dark ? 'dark' : 'light',
      style: '1', // 陰陽燭
      locale: 'zh_TW',
      allow_symbol_change: true,
      hide_side_toolbar: false, // 左邊畫線工具
      withdateranges: true,
      details: false,
      calendar: false,
      studies: ['STD;SMA', 'STD;RSI', 'STD;MACD'],
      support_host: 'https://www.tradingview.com',
    });
    box.appendChild(s);
    // 網絡封鎖（例如喺 Claude 預覽版）時 script 可能唔會觸發 onerror，所以加個逾時檢查
    const timer = setTimeout(() => { if (!box.querySelector('iframe')) setFailed(true); }, 12000);
    // 網絡慢嘅話圖表可能遲啲先出：一出現就收返提示
    const obs = new MutationObserver(() => { if (box.querySelector('iframe')) setFailed(false); });
    obs.observe(box, { childList: true, subtree: true });
    return () => { clearTimeout(timer); obs.disconnect(); box.innerHTML = ''; };
  }, [symbol, dark]);

  const link = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 text-sm text-ink-600 dark:text-ink-300 sm:grid-cols-3">
        <p><b>畫線：</b>用左邊工具列，例如「趨勢線」，喺圖上撳兩下就畫到一條線。</p>
        <p><b>加指標：</b>撳上面「指標」，搜尋 RSI、MACD、布林通道等。已經預設加咗均線、RSI、MACD。</p>
        <p><b>轉週期：</b>撳上面嘅「D」可以轉做週線（W）、月線（M）或者 1 小時線。</p>
      </div>
      {failed && (
        <div className="rounded-xl bg-ink-100 p-6 text-center text-sm dark:bg-ink-800">
          呢度載入唔到 TradingView 圖表（可能係網絡或者瀏覽器封鎖咗）。
          <a href={link} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-brand-600 underline dark:text-brand-300">去 TradingView 睇 {symbol}<ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      )}
      <div ref={ref} hidden={failed} className="tradingview-widget-container w-full overflow-hidden rounded-xl" style={{ height }} />
      <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-end text-xs text-ink-500 hover:text-brand-600">
        喺 TradingView 網站全螢幕打開<ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

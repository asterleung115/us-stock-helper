// 通用 TradingView 小工具嵌入（報價、跑馬燈等）
// 文件：https://www.tradingview.com/widget-docs/
import { useEffect, useRef, useState } from 'react';
import { useTheme } from './theme.jsx';

const EXCHANGE = { NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ', NASDAQ: 'NASDAQ', NYQ: 'NYSE', NYSE: 'NYSE', PCX: 'AMEX', ASE: 'AMEX', BTS: 'CBOE' };

/** 轉做 TradingView 代號：BRK-B → BRK.B；知道交易所就加前綴（例如 NASDAQ:AAPL） */
export function tvSymbol(ticker, exchange) {
  const t = ticker.replace(/-/g, '.');
  const ex = EXCHANGE[exchange];
  return ex ? `${ex}:${t}` : t;
}

/**
 * name: 小工具名，例如 'single-quote'、'ticker-tape'
 * config: 小工具設定（colorTheme、locale 會自動加）
 * fallback: 載入唔到時顯示嘅內容
 */
export default function TVWidget({ name, config, height, fallback = null, className = '' }) {
  const ref = useRef(null);
  const { dark } = useTheme();
  const [failed, setFailed] = useState(false);
  const json = JSON.stringify({ ...config, colorTheme: dark ? 'dark' : 'light', isTransparent: true, locale: 'zh_TW' });

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    setFailed(false);
    box.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    const s = document.createElement('script');
    s.src = `https://s3.tradingview.com/external-embedding/embed-widget-${name}.js`;
    s.async = true;
    s.type = 'text/javascript';
    s.onerror = () => setFailed(true);
    s.innerHTML = json;
    box.appendChild(s);
    const timer = setTimeout(() => { if (!box.querySelector('iframe')) setFailed(true); }, 12000);
    const obs = new MutationObserver(() => { if (box.querySelector('iframe')) setFailed(false); });
    obs.observe(box, { childList: true, subtree: true });
    return () => { clearTimeout(timer); obs.disconnect(); box.innerHTML = ''; };
  }, [name, json]);

  return (
    <>
      {failed && fallback}
      <div ref={ref} hidden={failed} className={`tradingview-widget-container w-full overflow-hidden ${className}`} style={height ? { height } : undefined} />
    </>
  );
}

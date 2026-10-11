// 深色 / 淺色模式：預設跟系統（亦會跟 Claude Artifact 嘅 data-theme 屬性），用戶可以喺設定頁改
import { createContext, useContext, useEffect, useState } from 'react';
import { load, save } from '../lib/storage.js';

const ThemeCtx = createContext({ dark: false, mode: 'system', setMode: () => {} });

function systemDark() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => load('theme', 'system'));
  const [sys, setSys] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSys(systemDark());
    mq.addEventListener('change', update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener('change', update); obs.disconnect(); };
  }, []);

  const dark = mode === 'dark' || (mode === 'system' && sys);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  const setMode = (m) => { setModeState(m); save('theme', m); };
  return <ThemeCtx.Provider value={{ dark, mode, setMode }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

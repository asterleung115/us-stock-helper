// localStorage 小工具：所有讀寫都包 try/catch（私隱模式或者被封鎖時唔會整爛個 App）

const PREFIX = 'ush:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 儲存唔到就算，唔影響使用 */
  }
}

/** API key：優先用「設定」頁輸入嘅，冇就用 .env 嘅 VITE_ 變數 */
export function getKeys() {
  const saved = load('keys', {});
  return {
    finnhub: saved.finnhub || import.meta.env.VITE_FINNHUB_KEY || '',
    alphavantage: saved.alphavantage || import.meta.env.VITE_ALPHAVANTAGE_KEY || '',
  };
}

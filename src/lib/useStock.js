// React hook：攞股票資料，處理載入中 / 錯誤 / 重試
import { useCallback, useEffect, useState } from 'react';
import { getStock, getMarket } from './api.js';

export function useStock(ticker) {
  const [state, setState] = useState({ loading: false, error: null, data: null, market: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!ticker) { setState({ loading: false, error: null, data: null, market: null }); return; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.all([getStock(ticker), getMarket()])
      .then(([data, market]) => alive && setState({ loading: false, error: null, data, market }))
      .catch((e) => alive && setState({ loading: false, error: e.message || String(e), data: null, market: null }));
    return () => { alive = false; };
  }, [ticker, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, retry };
}

// 數字格式化（全部處理 null，顯示「—」）

export const pct = (x, d = 1) => (x == null || Number.isNaN(x) ? '—' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(d)}%`);

export const money = (x) => {
  if (x == null || Number.isNaN(x)) return '—';
  const a = Math.abs(x);
  const s = a >= 1000 ? a.toLocaleString('en-US', { maximumFractionDigits: 0 }) : a >= 10 ? a.toFixed(2) : a.toFixed(3);
  return `${x < 0 ? '-' : ''}$${s}`;
};

/** 大數目用「億」「萬億」表示，香港人易明啲 */
export const bigMoney = (x) => {
  if (x == null) return '—';
  if (x >= 1e12) return `$${(x / 1e12).toFixed(2)} 萬億`;
  if (x >= 1e8) return `$${(x / 1e8).toFixed(0)} 億`;
  if (x >= 1e4) return `$${(x / 1e4).toFixed(0)} 萬`;
  return money(x);
};

export const upDown = (x) => (x == null ? '' : x >= 0 ? 'text-up' : 'text-down');

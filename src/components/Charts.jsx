// 圖表元件：用 TradingView 嘅 lightweight-charts 畫 K 線、均線、成交量、支持阻力、趨勢線、RSI、MACD
import { useEffect, useRef } from 'react';
import { createChart, LineStyle } from 'lightweight-charts';
import { useTheme } from './theme.jsx';

export const MA_COLORS = { 20: '#8b5cf6', 50: '#0ea5e9', 200: '#f59e0b' };

function palette(dark) {
  return {
    text: dark ? '#9fb0a9' : '#5d6e67',
    grid: dark ? '#26302d' : '#e7ebe9',
    up: dark ? '#22c55e' : '#16a34a',
    down: dark ? '#f87171' : '#dc2626',
    support: dark ? '#4ade80' : '#15803d',
    resist: dark ? '#fb7185' : '#be123c',
    trend: dark ? '#e5e7eb' : '#111827',
    accent: dark ? '#3fa48b' : '#156b5a',
  };
}

/** 建立一個自動跟住容器大小嘅圖表 */
function useChart(ref, dark, extra = {}) {
  const chartRef = useRef(null);
  useEffect(() => {
    const p = palette(dark);
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: p.text, fontFamily: '"IBM Plex Mono", ui-monospace, monospace' },
      grid: { vertLines: { visible: false }, horzLines: { color: p.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: 0 },
      ...extra,
    });
    chartRef.current = chart;
    return () => { chart.remove(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);
  return chartRef;
}

const toLine = (dates, arr) => dates.map((d, i) => (arr[i] == null ? { time: d } : { time: d, value: arr[i] }));

/** 將圖表顯示範圍設定為最後 bars 支 K 線 */
function showLast(chart, dates, bars) {
  if (!bars || bars >= dates.length) chart.timeScale().fitContent();
  else chart.timeScale().setVisibleRange({ from: dates[dates.length - bars], to: dates.at(-1) });
}

/**
 * 主圖：K 線（或收市價線）+ 均線 + 成交量 + 支持阻力 + 趨勢線 + 標記
 * props:
 *  series   { d, o, h, l, c, v }
 *  mas      [{ n, values }]
 *  sr       { supports:[{price}], resistances:[{price}] }
 *  trend    trendLine() 結果
 *  markers  [{ index, text, color }]
 *  bars     顯示最後幾多日
 */
export function PriceChart({ series, mas = [], sr, trend, volume = true, markers = [], bars = 252, height = 360, lineOnly = false }) {
  const ref = useRef(null);
  const { dark } = useTheme();
  const chartRef = useChart(ref, dark);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !series) return;
    const p = palette(dark);
    const d = series.d;
    const made = [];

    const main = lineOnly
      ? chart.addLineSeries({ color: p.accent, lineWidth: 2, priceLineVisible: false })
      : chart.addCandlestickSeries({ upColor: p.up, downColor: p.down, wickUpColor: p.up, wickDownColor: p.down, borderVisible: false });
    main.setData(lineOnly ? d.map((t, i) => ({ time: t, value: series.c[i] })) : d.map((t, i) => ({ time: t, open: series.o[i], high: series.h[i], low: series.l[i], close: series.c[i] })));
    main.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: volume ? 0.22 : 0.06 } });
    made.push(main);

    for (const m of mas) {
      const s = chart.addLineSeries({ color: MA_COLORS[m.n] || p.accent, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(toLine(d, m.values));
      made.push(s);
    }

    if (volume) {
      const v = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      v.setData(d.map((t, i) => ({ time: t, value: series.v[i], color: (series.c[i] >= series.o[i] ? p.up : p.down) + '66' })));
      made.push(v);
    }

    if (sr) {
      for (const s of sr.supports || []) main.createPriceLine({ price: s.price, color: p.support, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '支持' });
      for (const r of sr.resistances || []) main.createPriceLine({ price: r.price, color: p.resist, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '阻力' });
    }

    if (trend) {
      const s = chart.addLineSeries({ color: p.trend, lineWidth: 2, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData([{ time: d[trend.startIndex], value: trend.start }, { time: d.at(-1), value: trend.end }]);
      made.push(s);
    }

    if (markers.length) {
      main.setMarkers(markers.map((m) => ({ time: d[m.index], position: m.position || 'aboveBar', color: m.color || p.accent, shape: m.shape || 'arrowDown', text: m.text || '' })).sort((a, b) => (a.time < b.time ? -1 : 1)));
    }

    showLast(chart, d, bars);
    return () => { for (const s of made) { try { chart.removeSeries(s); } catch { /* 圖表已移除 */ } } };
  }, [chartRef, series, mas, sr, trend, volume, markers, bars, dark, lineOnly]);

  return <div ref={ref} style={{ height }} className="w-full" />;
}

/** RSI 副圖：畫 30 / 70 兩條參考線 */
export function RsiChart({ dates, values, bars = 252, height = 140 }) {
  const ref = useRef(null);
  const { dark } = useTheme();
  const chartRef = useChart(ref, dark);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !values) return;
    const p = palette(dark);
    const s = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 2, priceLineVisible: false });
    s.setData(toLine(dates, values));
    s.createPriceLine({ price: 70, color: p.resist, lineStyle: LineStyle.Dashed, lineWidth: 1, title: '超買 70' });
    s.createPriceLine({ price: 30, color: p.support, lineStyle: LineStyle.Dashed, lineWidth: 1, title: '超賣 30' });
    s.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
    showLast(chart, dates, bars);
    return () => { try { chart.removeSeries(s); } catch { /* */ } };
  }, [chartRef, dates, values, bars, dark]);
  return <div ref={ref} style={{ height }} className="w-full" />;
}

/** MACD 副圖：快線、訊號線、柱狀 */
export function MacdChart({ dates, macd, bars = 252, height = 150 }) {
  const ref = useRef(null);
  const { dark } = useTheme();
  const chartRef = useChart(ref, dark);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !macd) return;
    const p = palette(dark);
    const h = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
    h.setData(dates.map((d, i) => (macd.hist[i] == null ? { time: d } : { time: d, value: macd.hist[i], color: (macd.hist[i] >= 0 ? p.up : p.down) + '99' })));
    const l = chart.addLineSeries({ color: '#0ea5e9', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l.setData(toLine(dates, macd.line));
    const s = chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    s.setData(toLine(dates, macd.signal));
    showLast(chart, dates, bars);
    return () => { for (const x of [h, l, s]) { try { chart.removeSeries(x); } catch { /* */ } } };
  }, [chartRef, dates, macd, bars, dark]);
  return <div ref={ref} style={{ height }} className="w-full" />;
}

/** 比較圖：將幾隻股票由同一日開始當 100，睇邊隻升得多 */
export function CompareChart({ lines, height = 340 }) {
  const ref = useRef(null);
  const { dark } = useTheme();
  const chartRef = useChart(ref, dark);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const made = lines.map((ln) => {
      const s = chart.addLineSeries({ color: ln.color, lineWidth: 2, priceLineVisible: false, title: ln.label });
      s.setData(ln.points);
      return s;
    });
    chart.timeScale().fitContent();
    return () => { for (const s of made) { try { chart.removeSeries(s); } catch { /* */ } } };
  }, [chartRef, lines, dark]);
  return <div ref={ref} style={{ height }} className="w-full" />;
}

/** 圖例 */
export function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500 dark:text-ink-300">
      {items.map(([color, label, dashed]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4" style={{ borderTop: `${dashed ? '2px dashed' : '3px solid'} ${color}` }} />
          {label}
        </span>
      ))}
    </div>
  );
}

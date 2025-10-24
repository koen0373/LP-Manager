import React, { useMemo, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';

type TimeRange = '24h' | '7d' | '1m' | '1y';

export interface PricePoint {
  t: number | string; // unix seconds or ISO
  p: number;
}

export interface ActivityEvent {
  timestamp: string; // ISO
  type: 'mint' | 'transfer' | 'increase' | 'decrease' | 'collect' | 'burn';
  title?: string;
}

interface EChartsRangeChartProps {
  priceHistory: PricePoint[];
  minPrice?: number;
  maxPrice?: number;
  currentPrice?: number;
  activity?: ActivityEvent[];
  height?: number;
  className?: string;
}

/** --- Brand colors (Liqui) --- */
const LIQUI = {
  bg: 'transparent',
  grid: 'rgba(255,255,255,0.06)',
  line: '#3b82f6',     // blue for price
  areaTop: 'rgba(59,130,246,0.28)',
  areaBottom: 'rgba(59,130,246,0.00)',
  mist: '#AFC4E5',     // labels/axes
  aqua: '#75C4FF',     // highlights
  green: '#3DEB88',    // activity lines
  range: '#3FC57D',    // min/max lines
  now: '#3b82f6',      // current price (thick)
  crosshair: 'rgba(255,255,255,0.2)',
};

function toMs(t: number | string) {
  if (typeof t === 'number') {
    // assume unix seconds
    return t < 10_000_000_000 ? t * 1000 : t;
  }
  // ISO
  return new Date(t).getTime();
}

/** LTTB downsampling to max N points */
function downsampleLTTB(points: [number, number][], threshold = 500) {
  const n = points.length;
  if (threshold >= n || threshold === 0) return points;
  const sampled: [number, number][] = [];
  let a = 0;
  const bucket = (n - 2) / (threshold - 2);
  sampled.push(points[a]);

  for (let i = 0; i < threshold - 2; i++) {
    const start = Math.floor((i + 1) * bucket) + 1;
    const end = Math.floor((i + 2) * bucket) + 1;
    const startClamped = Math.min(start, n - 1);
    const endClamped = Math.min(end, n - 1);

    // avg for bucket
    let avgX = 0, avgY = 0, count = 0;
    for (let j = startClamped; j < endClamped; j++) {
      avgX += points[j][0];
      avgY += points[j][1];
      count++;
    }
    if (count === 0) {
      sampled.push(points[startClamped]);
      a = startClamped;
      continue;
    }
    avgX /= count; avgY /= count;

    // largest triangle
    let maxArea = -1, maxIndex = -1;
    for (let j = Math.floor(i * bucket) + 1; j < Math.floor((i + 1) * bucket) + 1; j++) {
      const ax = points[a][0], ay = points[a][1];
      const bx = points[j][0], by = points[j][1];
      const area = Math.abs((ax - avgX) * (by - ay) - (ax - bx) * (avgY - ay));
      if (area > maxArea) { maxArea = area; maxIndex = j; }
    }
    sampled.push(points[maxIndex]);
    a = maxIndex;
  }
  sampled.push(points[n - 1]);
  return sampled;
}

/** Formatters per timeframe */
function timeFormatter(timeRange: TimeRange) {
  return (val: number) => {
    const d = new Date(val);
    if (timeRange === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (timeRange === '7d' || timeRange === '1m') return d.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
    return d.toLocaleDateString([], { month: 'short' }); // 1y
  };
}

export default function EChartsRangeChart({
  priceHistory,
  minPrice = 0,
  maxPrice = 1,
  currentPrice = 0.5,
  height = 400,
  activity = [],
  className,
}: EChartsRangeChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  /** Sort, normalize to [ms, price] */
  const seriesRaw = useMemo(() => {
    const arr = [...priceHistory]
      .filter(p => Number.isFinite(p.p) && p.p > 0) // Filter out invalid prices
      .map(p => [toMs(p.t), p.p] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    
    // Detect and filter outliers (prices that are >10x the median)
    if (arr.length > 3) {
      const prices = arr.map(a => a[1]).sort((a, b) => a - b);
      const median = prices[Math.floor(prices.length / 2)];
      const filtered = arr.filter(([, price]) => {
        const ratio = price / median;
        return ratio > 0.1 && ratio < 10; // Within 10x of median
      });
      
      // Only use filtered data if we didn't remove everything
      if (filtered.length > arr.length * 0.5) {
        return filtered;
      }
    }
    
    return arr;
  }, [priceHistory]);

  /** Compute time window */
  const [fromTs, toTs] = useMemo(() => {
    const now = Date.now();
    switch (timeRange) {
      case '24h': return [now - 24 * 3600 * 1000, now];
      case '7d':  return [now - 7  * 24 * 3600 * 1000, now];
      case '1m':  return [now - 30 * 24 * 3600 * 1000, now];
      case '1y':  return [now - 365* 24 * 3600 * 1000, now];
    }
  }, [timeRange]);

  /** Filter to window (fallback if empty) */
  const filtered = useMemo(() => {
    const f = seriesRaw.filter(([t]) => t >= fromTs && t <= toTs);
    if (f.length > 0) return f;
    // Edge-case: no data → minimal fallback based on current/min/max over 24h
    const now = Date.now();
    return [
      [now - 24 * 3600 * 1000, Math.min(currentPrice, minPrice)],
      [now - 12 * 3600 * 1000, currentPrice],
      [now, Math.max(currentPrice, maxPrice)],
    ];
  }, [seriesRaw, fromTs, toTs, currentPrice, minPrice, maxPrice]);

  /** Downsample for performance */
  const data = useMemo(() => downsampleLTTB(filtered, 500), [filtered]);

  /** Activity vertical lines in window */
  const activityLines = useMemo(() => {
    const lines = activity
      .map(a => toMs(a.timestamp))
      .filter(ts => ts >= fromTs && ts <= toTs)
      .map(ts => ({
        xAxis: ts,
        lineStyle: { color: LIQUI.green, width: 1, type: 'solid' as const, opacity: 0.6 },
      }));
    return lines;
  }, [activity, fromTs, toTs]);

  /** Y padding so min/max sit visually centered-ish */
  const [yMin, yMax] = useMemo(() => {
    const values = data.map(d => d[1]).filter(v => Number.isFinite(v) && v > 0);
    if (values.length === 0) return [0, 1];
    
    // Get actual data range
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    
    // Include configured range boundaries
    const absoluteMin = Math.min(dataMin, minPrice);
    const absoluteMax = Math.max(dataMax, maxPrice);
    
    // Calculate range with padding
    const range = absoluteMax - absoluteMin;
    const padding = range * 0.15; // 15% padding top and bottom
    
    return [
      Math.max(0, absoluteMin - padding),
      absoluteMax + padding
    ];
  }, [data, minPrice, maxPrice]);

  /** markLines: min/max (horizontal) + NOW (horizontal thick) + activity (vertical) */
  const markLines = useMemo(() => {
    const hLines = [
      {
        yAxis: minPrice,
        lineStyle: { color: LIQUI.range, type: 'dashed' as const, width: 1.5 },
        label: { formatter: 'Min', position: 'insideEndRight' as const, color: LIQUI.mist },
      },
      {
        yAxis: maxPrice,
        lineStyle: { color: LIQUI.range, type: 'dashed' as const, width: 1.5 },
        label: { formatter: 'Max', position: 'insideEndRight' as const, color: LIQUI.mist },
      },
      {
        yAxis: currentPrice,
        lineStyle: { color: LIQUI.now, type: 'solid' as const, width: 2.5 },
        label: { formatter: 'Now', position: 'insideEndRight' as const, color: LIQUI.mist, fontWeight: 'bold' as const },
      },
    ];
    return [...hLines, ...activityLines];
  }, [minPrice, maxPrice, currentPrice, activityLines]);

  const xLabelFormatter = useMemo(() => timeFormatter(timeRange), [timeRange]);

  const option = useMemo(() => ({
    backgroundColor: LIQUI.bg,
    animation: true,
    grid: { left: 32, right: 24, top: 16, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: { color: LIQUI.crosshair },
        lineStyle: { color: LIQUI.crosshair },
      },
      backgroundColor: '#0B1A4A',
      borderColor: '#173064',
      borderWidth: 1,
      textStyle: { color: '#FFFFFF' },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? v.toFixed(6) : v),
      formatter: (params: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = Array.isArray(params) ? params[0] : (params as any);
        const ts = p?.axisValue ?? p?.data?.[0];
        const price = p?.data?.[1];
        const dt = new Date(ts);
        const stamp = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        return `${stamp}<br/>Price: ${Number(price).toFixed(6)}`;
      },
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: LIQUI.mist, formatter: (val: number) => xLabelFormatter(val) },
      axisLine: { lineStyle: { color: LIQUI.grid } },
      splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.03)' } },
      min: fromTs,
      max: toTs,
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      axisLabel: { color: LIQUI.mist },
      axisLine: { lineStyle: { color: LIQUI.grid } },
      splitLine: { show: true, lineStyle: { color: LIQUI.grid } },
    },
    series: [
      {
        name: 'Price',
        type: 'line',
        showSymbol: false,
        smooth: true,
        lineStyle: { color: LIQUI.line, width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: LIQUI.areaTop },
              { offset: 1, color: LIQUI.areaBottom },
            ],
          },
        },
        data,
        markLine: {
          symbol: 'none',
          silent: true,
          precision: 6,
          label: { color: LIQUI.mist },
          data: markLines,
        },
      },
    ],
  }), [data, fromTs, toTs, xLabelFormatter, yMin, yMax, markLines]);

  /** Time range buttons */
  const Button = useCallback(({ label, value }: { label: string; value: TimeRange }) => {
    const active = timeRange === value;
    return (
      <button
        onClick={() => setTimeRange(value)}
        className={`px-3 py-1.5 rounded-md text-sm transition
          ${active ? 'bg-liqui-aqua text-white' : 'bg-liqui-card-hover text-liqui-subtext hover:text-white'}`}
      >
        {label}
      </button>
    );
  }, [timeRange]);

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    const prices = data.map(d => d[1]);
    console.log('[EChartsRangeChart]', {
      timeRange,
      fromTs: new Date(fromTs).toISOString(),
      toTs: new Date(toTs).toISOString(),
      totalRawPoints: seriesRaw.length,
      filteredPoints: filtered.length,
      downsampledPoints: data.length,
      priceRange: {
        min: Math.min(...prices),
        max: Math.max(...prices),
        median: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)],
      },
      configuredRange: {
        minPrice,
        maxPrice,
        currentPrice,
      },
      yAxis: { yMin, yMax },
      outliers: priceHistory.filter(p => {
        const median = prices[Math.floor(prices.length / 2)];
        const ratio = p.p / median;
        return ratio < 0.1 || ratio > 10;
      }),
    });
  }

  return (
    <div className={`bg-liqui-card rounded-lg border border-liqui-border p-6 ${className || ''}`}>
      <div className="mb-4 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-bold text-white">Range & Price</h2>
          <p className="text-sm text-liqui-subtext">Track live price vs your range</p>
        </div>
        {/* Time Range Selector */}
        <div className="flex gap-1">
          <Button label="24h" value="24h" />
          <Button label="7D"  value="7d"  />
          <Button label="1M"  value="1m"  />
          <Button label="1Y"  value="1y"  />
        </div>
      </div>

      <ReactECharts
        option={option}
        notMerge
        lazyUpdate={false}
        style={{ height: `${height}px`, width: '100%' }}
      />
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';

type TimeRange = '24h' | '7d' | '1m' | '1y';

export interface PricePoint {
  t: number | string; // unix seconds or ISO
  p: number; // price
}

interface PriceChartProps {
  priceHistory: PricePoint[];
  token0Symbol?: string; // e.g., "FXRP"
  token1Symbol?: string; // e.g., "USDT"
  height?: number;
  className?: string;
}

/** Convert timestamp to milliseconds */
function toMs(t: number | string): number {
  if (typeof t === 'number') {
    return t < 10_000_000_000 ? t * 1000 : t;
  }
  return new Date(t).getTime();
}

export default function PriceChart({
  priceHistory,
  token0Symbol = '',
  token1Symbol = '',
  height = 400,
  className = '',
}: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');
  
  // Determine which token's price we're showing (usually token0 in USDT)
  const priceLabel = token0Symbol && token1Symbol 
    ? `${token0Symbol} price in ${token1Symbol}`
    : 'Price';

  /** Convert priceHistory to [timestamp_ms, price] tuples */
  const rawData = useMemo(() => {
    return priceHistory
      .filter(p => Number.isFinite(p.p) && p.p > 0)
      .map(p => [toMs(p.t), p.p] as [number, number])
      .sort((a, b) => a[0] - b[0]);
  }, [priceHistory]);

  /** Calculate time window */
  const [fromTs, toTs] = useMemo(() => {
    const now = Date.now();
    switch (timeRange) {
      case '24h': return [now - 24 * 3600 * 1000, now];
      case '7d':  return [now - 7  * 24 * 3600 * 1000, now];
      case '1m':  return [now - 30 * 24 * 3600 * 1000, now];
      case '1y':  return [now - 365* 24 * 3600 * 1000, now];
    }
  }, [timeRange]);

  /** Filter data to selected time window */
  const filteredData = useMemo(() => {
    return rawData.filter(([t]) => t >= fromTs && t <= toTs);
  }, [rawData, fromTs, toTs]);

  /** Calculate Y-axis range (auto-scale based on visible data) */
  const [yMin, yMax] = useMemo(() => {
    if (filteredData.length === 0) return [0, 1];
    
    const prices = filteredData.map(d => d[1]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    const padding = range * 0.15; // 15% padding
    
    return [
      Math.max(0, min - padding),
      max + padding
    ];
  }, [filteredData]);

  /** X-axis label formatter */
  const xLabelFormatter = useMemo(() => {
    return (val: number) => {
      const d = new Date(val);
      if (timeRange === '24h') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (timeRange === '7d' || timeRange === '1m') {
        return d.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short' });
    };
  }, [timeRange]);

  /** Y-axis label formatter (smart decimals) */
  const yLabelFormatter = (value: number) => {
    if (value >= 1000) return value.toFixed(0);
    if (value >= 10) return value.toFixed(2);
    if (value >= 1) return value.toFixed(3);
    if (value >= 0.01) return value.toFixed(4);
    return value.toFixed(6);
  };

  /** ECharts option */
  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    animation: true,
    grid: { left: 60, right: 24, top: 16, bottom: 32 },
    
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: { color: 'rgba(255,255,255,0.2)' },
      },
      backgroundColor: '#0B1A4A',
      borderColor: '#173064',
      borderWidth: 1,
      textStyle: { color: '#FFFFFF' },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        const ts = p?.axisValue ?? p?.data?.[0];
        const price = p?.data?.[1];
        const dt = new Date(ts);
        const dateStr = dt.toLocaleDateString();
        const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const priceStr = Number(price).toFixed(6);
        const label = token1Symbol ? `${token0Symbol}/${token1Symbol}` : 'Price';
        return `${dateStr} ${timeStr}<br/>${label}: <b>${priceStr}</b>`;
      },
    },
    
    xAxis: {
      type: 'time',
      min: fromTs,
      max: toTs,
      axisLabel: { 
        color: '#AFC4E5',
        formatter: xLabelFormatter,
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.03)' } },
    },
    
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      axisLabel: { 
        color: '#AFC4E5',
        formatter: yLabelFormatter,
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    
    series: [
      {
        name: 'Price',
        type: 'line',
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#3b82f6', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.28)' },
              { offset: 1, color: 'rgba(59,130,246,0.00)' },
            ],
          },
        },
        data: filteredData,
      },
    ],
  }), [filteredData, fromTs, toTs, yMin, yMax, xLabelFormatter, token0Symbol, token1Symbol]);

  return (
    <div className={`w-full ${className}`}>
      {/* Time range selector */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-liqui-mist">
            {token0Symbol ? `${token0Symbol} Price` : 'Price'}
          </h3>
          <p className="text-sm text-liqui-mist/60">
            {priceLabel}
          </p>
        </div>
        
        <div className="flex gap-2">
          {(['24h', '7d', '1m', '1y'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-liqui-accent text-white'
                  : 'bg-liqui-card text-liqui-mist hover:bg-liqui-card-hover'
              }`}
            >
              {range === '24h' ? '24h' : range === '7d' ? '7D' : range === '1m' ? '1M' : '1Y'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-liqui-card border border-liqui-border rounded-xl p-4">
        {filteredData.length === 0 ? (
          <div 
            className="flex items-center justify-center text-liqui-mist/40"
            style={{ height }}
          >
            No price data available for this timeframe
          </div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height, width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        )}
      </div>
    </div>
  );
}


import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { TimeRange, getWindowMs, normalizeTimestamp, getXAxisFormatter } from '@/lib/utils/time';

interface PricePoint {
  t: number | string;
  p: number;
}

interface ActivityEvent {
  timestamp: string;
  type: 'mint' | 'transfer' | 'increase' | 'decrease' | 'collect' | 'burn';
  title: string;
}

interface EChartsRangeChartProps {
  priceHistory: PricePoint[];
  minPrice?: number;
  maxPrice?: number;
  currentPrice?: number;
  activity?: ActivityEvent[];
  timeRange: TimeRange;
  height?: number;
}

export default function EChartsRangeChart({
  priceHistory,
  minPrice = 0,
  maxPrice = 1,
  currentPrice = 0.5,
  activity = [],
  timeRange,
  height = 400,
}: EChartsRangeChartProps) {
  // 1. Normalize and sort all price data
  const normalizedHistory = useMemo(() => {
    const normalized = priceHistory
      .map(point => ({
        tMs: normalizeTimestamp(point.t),
        p: point.p,
      }))
      .filter(point => Number.isFinite(point.tMs) && Number.isFinite(point.p) && point.p > 0)
      .sort((a, b) => a.tMs - b.tMs);

    // Deduplicate same timestamps (keep last)
    const deduped: typeof normalized = [];
    for (let i = 0; i < normalized.length; i++) {
      if (i === normalized.length - 1 || normalized[i].tMs !== normalized[i + 1].tMs) {
        deduped.push(normalized[i]);
      }
    }

    return deduped;
  }, [priceHistory]);

  // 2. Calculate window and filter data
  const { filteredData, startMs, endMs } = useMemo(() => {
    if (normalizedHistory.length === 0) {
      return { filteredData: [], startMs: Date.now() - getWindowMs('7d'), endMs: Date.now() };
    }

    const endMs = normalizedHistory[normalizedHistory.length - 1].tMs;
    let windowMs = getWindowMs(timeRange);
    let startMs = endMs - windowMs;

    // Filter to window
    let filtered = normalizedHistory.filter(p => p.tMs >= startMs && p.tMs <= endMs);

    // Fallback to larger windows if < 2 points
    const fallbackOrder: TimeRange[] = ['24h', '7d', '1m', '1y'];
    const currentIndex = fallbackOrder.indexOf(timeRange);
    
    for (let i = currentIndex + 1; i < fallbackOrder.length && filtered.length < 2; i++) {
      windowMs = getWindowMs(fallbackOrder[i]);
      startMs = endMs - windowMs;
      filtered = normalizedHistory.filter(p => p.tMs >= startMs && p.tMs <= endMs);
    }

    // Final fallback: use all data
    if (filtered.length < 2) {
      filtered = normalizedHistory;
      startMs = filtered[0]?.tMs || startMs;
    }

    return { filteredData: filtered, startMs, endMs };
  }, [normalizedHistory, timeRange]);

  // 3. Outlier filtering and data cleaning
  const cleanedData = useMemo(() => {
    if (filteredData.length === 0) return [];

    const cleaned: Array<[number, number]> = [];
    let lastValid = filteredData[0].p;

    for (const point of filteredData) {
      const { tMs, p } = point;

      // Skip outliers: > 50% deviation from previous OR > 3x minPrice OR > 2x last valid
      const maxAllowed = Math.max(minPrice * 3, lastValid * 2);
      const minAllowed = lastValid * 0.5;

      if (p > maxAllowed || p < minAllowed) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[CHART] Outlier filtered: ${p} (last: ${lastValid}, range: ${minAllowed}-${maxAllowed})`);
        }
        continue;
      }

      cleaned.push([tMs, p]);
      lastValid = p;
    }

    // Warn if we dropped > 30%
    const dropRate = 1 - (cleaned.length / filteredData.length);
    if (dropRate > 0.3 && process.env.NODE_ENV !== 'production') {
      console.warn(`[CHART] Dropped ${(dropRate * 100).toFixed(1)}% of points as outliers`);
    }

    return cleaned;
  }, [filteredData, minPrice]);

  // 4. Filter activity markers to window
  const filteredActivity = useMemo(() => {
    return activity
      .map(event => ({
        ...event,
        tMs: normalizeTimestamp(event.timestamp),
      }))
      .filter(event => event.tMs >= startMs && event.tMs <= endMs);
  }, [activity, startMs, endMs]);

  // 5. Calculate Y-axis range with padding
  const [yMin, yMax] = useMemo(() => {
    if (cleanedData.length === 0) {
      const band = maxPrice - minPrice || 1;
      return [
        Math.max(0, minPrice - band * 1.0),
        maxPrice + band * 1.0,
      ];
    }

    const prices = cleanedData.map(d => d[1]);
    const dataMin = Math.min(...prices, minPrice);
    const dataMax = Math.max(...prices, maxPrice);
    const band = dataMax - dataMin || 1;

    return [
      Math.max(0, dataMin - band * 1.0),
      dataMax + band * 1.0,
    ];
  }, [cleanedData, minPrice, maxPrice]);

  // 6. Build ECharts option
  const option = useMemo((): EChartsOption => {
    const xFormatter = getXAxisFormatter(timeRange);

    return {
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
          return `${dateStr} ${timeStr}<br/>Price: <b>${Number(price).toFixed(6)}</b>`;
        },
      },
      
      xAxis: {
        type: 'time',
        min: startMs,
        max: endMs,
        axisLabel: { 
          color: '#AFC4E5',
          formatter: xFormatter,
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
          formatter: (v: number) => {
            if (v >= 1000) return v.toFixed(0);
            if (v >= 10) return v.toFixed(2);
            if (v >= 1) return v.toFixed(3);
            if (v >= 0.01) return v.toFixed(4);
            return v.toFixed(6);
          },
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      
      series: [
        // Price line
        {
          name: 'Price',
          type: 'line',
          data: cleanedData.length > 0 ? cleanedData : [[startMs, currentPrice], [endMs, currentPrice]],
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
        },
        // Min/Max range lines
        ...(minPrice > 0 && maxPrice > 0 ? [
          {
            name: 'Range',
            type: 'line' as const,
            markLine: {
              symbol: 'none',
              silent: true,
              data: [
                {
                  yAxis: minPrice,
                  lineStyle: { color: '#3DEB88', type: 'dashed' as const, width: 1.5 },
                  label: { formatter: 'Min', color: '#AFC4E5', fontSize: 11 },
                },
                {
                  yAxis: maxPrice,
                  lineStyle: { color: '#3DEB88', type: 'dashed' as const, width: 1.5 },
                  label: { formatter: 'Max', color: '#AFC4E5', fontSize: 11 },
                },
              ],
            },
          },
        ] : []),
        // Current price line
        ...(currentPrice > 0 ? [
          {
            name: 'Current',
            type: 'line' as const,
            markLine: {
              symbol: 'none',
              silent: true,
              data: [
                {
                  yAxis: currentPrice,
                  lineStyle: { color: '#3b82f6', type: 'solid' as const, width: 2.5 },
                  label: { formatter: 'Now', color: '#3b82f6', fontWeight: 'bold' as const, fontSize: 11 },
                },
              ],
            },
          },
        ] : []),
        // Activity markers
        ...(filteredActivity.length > 0 ? [
          {
            name: 'Events',
            type: 'line' as const,
            markLine: {
              symbol: 'none',
              silent: false,
              data: filteredActivity.map(event => ({
                xAxis: event.tMs,
                lineStyle: { color: '#3DEB88', type: 'solid' as const, width: 1, opacity: 0.6 },
                label: { show: false },
              })),
            },
          },
        ] : []),
      ],
    };
  }, [cleanedData, startMs, endMs, yMin, yMax, minPrice, maxPrice, currentPrice, filteredActivity, timeRange]);

  // 7. Render with empty state fallback
  if (normalizedHistory.length === 0) {
    return (
      <div style={{ height, width: '100%' }} className="flex items-center justify-center text-liqui-subtext">
        No price history available for this period
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: `${height}px`, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge={true}
      lazyUpdate={false}
    />
  );
}

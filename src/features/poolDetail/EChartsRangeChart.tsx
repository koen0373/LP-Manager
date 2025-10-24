import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { TimeRange, getWindowMs, normalizeTimestamp, getXAxisFormatter } from '@/lib/utils/time';
import { getLivePoolPrice } from '@/lib/onchain/readers';

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
  poolAddress?: string;
  decimals0?: number;
  decimals1?: number;
  enableLiveUpdates?: boolean;
  height?: number;
}

export default function EChartsRangeChart({
  priceHistory,
  minPrice = 0,
  maxPrice = 1,
  currentPrice = 0.5,
  activity = [],
  timeRange,
  poolAddress,
  decimals0 = 18,
  decimals1 = 18,
  enableLiveUpdates = false,
  height = 400,
}: EChartsRangeChartProps) {
  const chartRef = useRef<ReactECharts | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  // Live price polling (every 30s)
  useEffect(() => {
    if (!enableLiveUpdates || !poolAddress || typeof decimals0 !== 'number' || typeof decimals1 !== 'number') {
      return;
    }

    const pollPrice = async () => {
      try {
        const price = await getLivePoolPrice(poolAddress as `0x${string}`, decimals0, decimals1);
        if (price !== null && Number.isFinite(price) && price > 0) {
          setLivePrice(price);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[CHART] Failed to poll live price:', error);
        }
      }
    };

    // Initial fetch
    pollPrice();

    // Poll every 30s
    const interval = setInterval(pollPrice, 30_000);
    return () => clearInterval(interval);
  }, [poolAddress, decimals0, decimals1, enableLiveUpdates]);

  // Use live price if available, otherwise fall back to currentPrice prop
  const effectiveCurrentPrice = useMemo(() => {
    return livePrice !== null ? livePrice : currentPrice;
  }, [livePrice, currentPrice]);
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

    // Calculate median for outlier detection
    const prices = filteredData.map(p => p.p).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)] || minPrice || 1;
    const maxBand = Math.max(maxPrice * 5, median * 10);
    const minBand = Math.max(0.00001, minPrice / 5, median * 0.1);

    const cleaned: Array<[number, number]> = [];
    let lastValid = filteredData[0]?.p || median;
    let outlierCount = 0;

    for (const point of filteredData) {
      const { tMs, p } = point;

      // Multi-stage outlier filter
      // 1) Band clamp: price must be within [minBand, maxBand]
      if (p < minBand || p > maxBand) {
        outlierCount++;
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[OUTLIER] Price ${p.toFixed(6)} outside band [${minBand.toFixed(6)}, ${maxBand.toFixed(6)}]`);
        }
        continue;
      }

      // 2) Jump detection: >50% deviation from previous valid point
      const maxAllowed = lastValid * 1.5;
      const minAllowed = lastValid * 0.5;

      if (p > maxAllowed || p < minAllowed) {
        outlierCount++;
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[OUTLIER] Jump detected: ${p.toFixed(6)} (last: ${lastValid.toFixed(6)}, allowed: ${minAllowed.toFixed(6)}-${maxAllowed.toFixed(6)})`);
        }
        continue;
      }

      // 3) Median deviation: >10x median is suspicious
      if (p > median * 10 || p < median * 0.1) {
        outlierCount++;
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[OUTLIER] Median deviation: ${p.toFixed(6)} (median: ${median.toFixed(6)})`);
        }
        continue;
      }

      cleaned.push([tMs, p]);
      lastValid = p;
    }

    if (outlierCount > 0 && process.env.NODE_ENV !== 'production') {
      console.log(`[CHART] Filtered ${outlierCount} outliers (kept ${cleaned.length}/${filteredData.length} points)`);
    }

    return cleaned;
  }, [filteredData, minPrice, maxPrice]);

  // 4. Downsample if > 500 points (simple step sampling, LTTB can be added later)
  const downsampledData = useMemo(() => {
    if (cleanedData.length <= 500) return cleanedData;
    
    const step = Math.ceil(cleanedData.length / 500);
    const sampled = cleanedData.filter((_, i) => i % step === 0);
    sampled.push(cleanedData[cleanedData.length - 1]); // Always keep last point
    return sampled;
  }, [cleanedData]);

  // 5. Filter activity markers to window
  const filteredActivity = useMemo(() => {
    return activity
      .map(event => ({
        ...event,
        tMs: normalizeTimestamp(event.timestamp),
      }))
      .filter(event => event.tMs >= startMs && event.tMs <= endMs);
  }, [activity, startMs, endMs]);

  // 6. Calculate Y-axis range with padding (ensure min/max are visible)
  const [yMin, yMax] = useMemo(() => {
    if (downsampledData.length === 0) {
      const band = maxPrice - minPrice || 1;
      return [
        Math.max(0, minPrice - band * 0.15),
        maxPrice + band * 0.15,
      ];
    }

    const prices = downsampledData.map(d => d[1]);
    const dataMin = Math.min(...prices, minPrice, effectiveCurrentPrice);
    const dataMax = Math.max(...prices, maxPrice, effectiveCurrentPrice);
    const band = dataMax - dataMin || 1;

    return [
      Math.max(0, dataMin - band * 0.02),
      dataMax + band * 0.02,
    ];
  }, [downsampledData, minPrice, maxPrice, effectiveCurrentPrice]);

  // 7. Build ECharts option
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
        formatter: (params: unknown) => {
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
          data: downsampledData.length > 0 ? downsampledData : [[startMs, effectiveCurrentPrice], [endMs, effectiveCurrentPrice]],
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
        // Current price line (Now)
        ...(effectiveCurrentPrice > 0 ? [
          {
            name: 'Current',
            type: 'line' as const,
            markLine: {
              symbol: 'none',
              silent: true,
              data: [
                {
                  yAxis: effectiveCurrentPrice,
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
  }, [downsampledData, startMs, endMs, yMin, yMax, minPrice, maxPrice, effectiveCurrentPrice, filteredActivity, timeRange]);

  // 8. Update "Now" line smoothly when livePrice changes (without full rerender)
  useEffect(() => {
    if (!chartRef.current || livePrice === null) return;
    
    const chartInstance = chartRef.current.getEchartsInstance();
    if (!chartInstance) return;

    // Update only the "Now" markLine
    chartInstance.setOption({
      series: option.series,
    }, { replaceMerge: ['series'] });
  }, [livePrice, option.series]);

  // 9. Render with empty state fallback
  if (normalizedHistory.length === 0) {
    return (
      <div style={{ height, width: '100%' }} className="flex items-center justify-center text-liqui-subtext">
        No price history available for this period
      </div>
    );
  }

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height: `${height}px`, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge={true}
      lazyUpdate={false}
    />
  );
}

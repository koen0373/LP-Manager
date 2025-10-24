import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

type TimeRange = '24h' | '7d' | '1m' | '1y';

interface PricePoint {
  t: number | string; // unix timestamp (can be string from API)
  p: number; // price
}

interface EChartsRangeChartProps {
  priceHistory: PricePoint[];
  minPrice?: number;
  maxPrice?: number;
  currentPrice?: number;
  height?: number;
}

export default function EChartsRangeChart({
  priceHistory,
  minPrice,
  maxPrice,
  currentPrice,
  height = 400,
}: EChartsRangeChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');
  
  // Calculate time window based on selected range
  const timeWindow = useMemo(() => {
    const now = Date.now();
    switch (timeRange) {
      case '24h': return now - 24 * 3600 * 1000;
      case '7d':  return now - 7 * 24 * 3600 * 1000;
      case '1m':  return now - 30 * 24 * 3600 * 1000;
      case '1y':  return now - 365 * 24 * 3600 * 1000;
    }
  }, [timeRange]);
  
  const option = useMemo(() => {
    // Sort and format data, then filter by time window
    const sortedData = [...priceHistory]
      .sort((a, b) => {
        const timeA = typeof a.t === 'string' ? parseInt(a.t, 10) : a.t;
        const timeB = typeof b.t === 'string' ? parseInt(b.t, 10) : b.t;
        return timeA - timeB;
      })
      .map(point => {
        const time = typeof point.t === 'string' ? parseInt(point.t, 10) : point.t;
        return [time * 1000, point.p]; // Convert to milliseconds for ECharts
      })
      .filter(([time]) => time >= timeWindow); // Filter by selected time range

    // Calculate Y-axis range to scale min/max prices to 25%/75%
    let yMin = 0;
    let yMax = 100;
    
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > 0 && maxPrice > 0) {
      const range = maxPrice - minPrice;
      yMin = Math.max(0, minPrice - range * 0.5); // Min at 25% → add 50% padding below
      yMax = maxPrice + range * 0.5; // Max at 75% → add 50% padding above
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: 'rgba(255,255,255,0.2)',
          },
        },
        backgroundColor: 'rgba(10, 10, 10, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: {
          color: '#fff',
          fontFamily: 'Quicksand, sans-serif',
        },
        formatter: (params: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const typedParams = params as any;
          if (!typedParams || !typedParams[0]) return '';
          const date = new Date(typedParams[0].value[0]);
          const price = typedParams[0].value[1].toFixed(6);
          
          // Use UTC to avoid hydration issues
          const dateStr = `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
          const timeStr = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
          
          return `
            <div style="font-size: 12px;">
              <div style="color: #9CA3AF;">${dateStr} ${timeStr}</div>
              <div style="margin-top: 4px;"><strong>Price: ${price}</strong></div>
            </div>
          `;
        },
      },
      grid: {
        left: '3%',
        right: '3%',
        top: '10%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        axisLine: {
          lineStyle: {
            color: 'rgba(255,255,255,0.1)',
          },
        },
        axisLabel: {
          color: '#9CA3AF',
          fontFamily: 'Quicksand, sans-serif',
          fontSize: 11,
          formatter: (value: number) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          },
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255,255,255,0.03)',
          },
        },
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax,
        axisLine: {
          show: false,
        },
        axisLabel: {
          color: '#9CA3AF',
          fontFamily: 'Quicksand, sans-serif',
          fontSize: 11,
          formatter: (value: number) => value.toFixed(4),
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255,255,255,0.06)',
          },
        },
      },
      series: [
        // Main price line
        {
          name: 'Price',
          type: 'line',
          data: sortedData,
          smooth: true,
          lineStyle: {
            color: '#3b82f6',
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.35)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0)' },
              ],
            },
          },
          symbol: 'none',
          emphasis: {
            focus: 'series',
            lineStyle: {
              width: 3,
            },
          },
        },
        // Min price line
        ...(minPrice !== undefined
          ? [
              {
                name: 'Min Price',
                type: 'line',
                markLine: {
                  symbol: 'none',
                  data: [
                    {
                      yAxis: minPrice,
                      lineStyle: {
                        color: '#16a34a',
                        type: 'dashed' as const,
                        width: 1,
                      },
                      label: {
                        formatter: 'Min',
                        color: '#16a34a',
                        fontFamily: 'Quicksand, sans-serif',
                        fontSize: 11,
                      },
                    },
                  ],
                },
              },
            ]
          : []),
        // Max price line
        ...(maxPrice !== undefined
          ? [
              {
                name: 'Max Price',
                type: 'line',
                markLine: {
                  symbol: 'none',
                  data: [
                    {
                      yAxis: maxPrice,
                      lineStyle: {
                        color: '#16a34a',
                        type: 'dashed' as const,
                        width: 1,
                      },
                      label: {
                        formatter: 'Max',
                        color: '#16a34a',
                        fontFamily: 'Quicksand, sans-serif',
                        fontSize: 11,
                      },
                    },
                  ],
                },
              },
            ]
          : []),
        // Current price line
        ...(currentPrice !== undefined
          ? [
              {
                name: 'Current Price',
                type: 'line',
                markLine: {
                  symbol: 'none',
                  data: [
                    {
                      yAxis: currentPrice,
                      lineStyle: {
                        color: '#3b82f6',
                        type: 'solid' as const,
                        width: 2,
                      },
                      label: {
                        formatter: 'Now',
                        color: '#3b82f6',
                        fontFamily: 'Quicksand, sans-serif',
                        fontSize: 11,
                        fontWeight: 'bold',
                      },
                    },
                  ],
                },
              },
            ]
          : []),
      ],
    };
  }, [priceHistory, minPrice, maxPrice, currentPrice, timeWindow]);

  return (
    <div className="bg-liqui-card rounded-lg border border-liqui-border p-6">
      {/* Header with time selector */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Range & Price</h2>
          <p className="text-sm text-liqui-subtext">Track live price vs your range</p>
        </div>
        
        {/* Time range selector */}
        <div className="flex gap-2">
          {(['24h', '7d', '1m', '1y'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-liqui-accent text-white'
                  : 'bg-liqui-card-hover text-liqui-mist hover:bg-liqui-border'
              }`}
            >
              {range === '24h' ? '24h' : range === '7d' ? '7D' : range === '1m' ? '1M' : '1Y'}
            </button>
          ))}
        </div>
      </div>
      <ReactECharts
        option={option as EChartsOption}
        style={{ height: `${height}px`, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}


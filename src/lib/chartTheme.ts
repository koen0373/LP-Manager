/**
 * Liqui Brand Chart Theme
 * For use with ECharts and other charting libraries
 */

export const chartTheme = {
  background: '#0D0F13',     // liqui-night
  grid: '#1C2028',           // liqui-grid
  line: '#AFC4E5',           // liqui-mist
  highlight: '#8EB5D8',      // liqui-ocean
  tooltipBg: '#0B1A4A',      // liqui-deep
  tooltipText: '#FFFFFF',    // liqui-white
  success: '#3FC57D',        // liqui-success
  warning: '#F59E0B',
  error: '#EF4444',
  textPrimary: '#FFFFFF',
  textSecondary: '#9AA4B2',
  cardBg: '#15171D',         // liqui-card
};

/**
 * ECharts default options with Liqui branding
 */
export const getEChartsBaseOptions = () => ({
  backgroundColor: chartTheme.background,
  textStyle: {
    fontFamily: 'Quicksand, sans-serif',
    color: chartTheme.textSecondary,
  },
  grid: {
    left: 24,
    right: 24,
    top: 16,
    bottom: 24,
    containLabel: true,
  },
  tooltip: {
    trigger: 'axis',
    backgroundColor: chartTheme.tooltipBg,
    borderColor: '#173064',
    borderWidth: 1,
    textStyle: {
      color: chartTheme.tooltipText,
      fontSize: 12,
    },
    padding: [8, 12],
  },
  xAxis: {
    type: 'category',
    axisLine: {
      lineStyle: {
        color: chartTheme.grid,
      },
    },
    axisLabel: {
      color: chartTheme.textSecondary,
      fontSize: 11,
    },
    splitLine: {
      show: false,
    },
  },
  yAxis: {
    type: 'value',
    splitLine: {
      lineStyle: {
        color: chartTheme.grid,
        type: 'dashed',
      },
    },
    axisLabel: {
      color: chartTheme.textSecondary,
      fontSize: 11,
    },
    axisLine: {
      show: false,
    },
  },
});

/**
 * Line chart series with Liqui branding
 */
export const getLiquiLineSeriesStyle = () => ({
  type: 'line',
  smooth: true,
  lineStyle: {
    color: chartTheme.line,
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
        { offset: 0, color: '#AFC4E5aa' },
        { offset: 1, color: '#AFC4E500' },
      ],
    },
  },
  showSymbol: false,
  emphasis: {
    focus: 'series',
    lineStyle: {
      color: chartTheme.highlight,
      width: 3,
    },
  },
});


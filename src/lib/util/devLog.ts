// Production-safe logging utilities
// Only logs in development, silent in production unless DEBUG_LOGS=true

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
const debugEnabled = typeof process !== 'undefined' && process.env.DEBUG_LOGS === 'true';
const shouldLog = isDev || debugEnabled;

export const devLog = {
  log: (...args: unknown[]) => {
    if (shouldLog) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors, even in production
    console.error(...args);
  },
  // Always log (for critical production logs)
  always: (...args: unknown[]) => {
    console.log(...args);
  },
};

// For backward compatibility
export const log = devLog.log;
export const warn = devLog.warn;
export const error = devLog.error;


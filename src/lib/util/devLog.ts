// Production-safe logging utilities
// Only logs in development, silent in production

const isDev = process.env.NODE_ENV !== 'production';

export const devLog = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
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


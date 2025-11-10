/**
 * CET Timezone Utilities
 * 
 * Central European Time (CET) = UTC+1 (wintertijd)
 * Central European Summer Time (CEST) = UTC+2 (zomertijd)
 * 
 * Zomertijd loopt van laatste zondag in maart tot laatste zondag in oktober
 */

/**
 * Check if a date is in summer time (CEST) or winter time (CET)
 * Zomertijd: laatste zondag maart tot laatste zondag oktober
 */
function isDST(date: Date): boolean {
  const year = date.getUTCFullYear();
  
  // Find last Sunday in March
  const marchLastSunday = new Date(Date.UTC(year, 2, 31)); // March 31
  marchLastSunday.setUTCDate(31 - marchLastSunday.getUTCDay());
  
  // Find last Sunday in October
  const octoberLastSunday = new Date(Date.UTC(year, 9, 31)); // October 31
  octoberLastSunday.setUTCDate(31 - octoberLastSunday.getUTCDay());
  
  // DST starts at 2:00 AM UTC on last Sunday of March
  const dstStart = new Date(marchLastSunday);
  dstStart.setUTCHours(2, 0, 0, 0);
  
  // DST ends at 3:00 AM UTC on last Sunday of October
  const dstEnd = new Date(octoberLastSunday);
  dstEnd.setUTCHours(3, 0, 0, 0);
  
  return date >= dstStart && date < dstEnd;
}

/**
 * Get CET offset in hours for a given date
 * Returns 1 for CET (winter) or 2 for CEST (summer)
 */
export function getCETOffset(date: Date = new Date()): number {
  return isDST(date) ? 2 : 1;
}

/**
 * Convert Unix timestamp (seconds) to CET Date object
 */
export function unixToCET(unixTimestamp: number): Date {
  const utcDate = new Date(unixTimestamp * 1000);
  const offset = getCETOffset(utcDate);
  return new Date(utcDate.getTime() + (offset * 60 * 60 * 1000));
}

/**
 * Format Unix timestamp as CET string
 * Format: "2025-11-10 19:44:06 CET" or "2025-11-10 20:44:06 CEST"
 */
export function formatCET(unixTimestamp: number): string {
  const utcDate = new Date(unixTimestamp * 1000);
  const offset = getCETOffset(utcDate);
  const cetDate = new Date(utcDate.getTime() + (offset * 60 * 60 * 1000));
  const tzLabel = offset === 2 ? 'CEST' : 'CET';
  return cetDate.toISOString().replace('T', ' ').substring(0, 19) + ` ${tzLabel}`;
}

/**
 * Format Date object as CET string
 */
export function formatDateCET(date: Date): string {
  return formatCET(Math.floor(date.getTime() / 1000));
}

/**
 * Get 18:00 CET today as Unix timestamp
 */
export function getToday18CETUnix(): number {
  const now = new Date();
  const offset = getCETOffset(now);
  
  // Get current date in CET
  const nowCET = new Date(now.getTime() + (offset * 60 * 60 * 1000));
  
  // Create 18:00 CET today
  const today18CET = new Date(Date.UTC(
    nowCET.getUTCFullYear(),
    nowCET.getUTCMonth(),
    nowCET.getUTCDate(),
    18 - offset, // Adjust for CET offset
    0,
    0
  ));
  
  return Math.floor(today18CET.getTime() / 1000);
}

/**
 * Get 19:00 CET today as Unix timestamp
 */
export function getToday19CETUnix(): number {
  return getToday18CETUnix() + 3600; // Add 1 hour
}


/**
 * Format date consistently across server and client
 * Prevents hydration errors by using manual formatting instead of toLocaleDateString
 * CRITICAL: Uses UTC to ensure server/client consistency regardless of timezone
 */

export function formatDate(isoString: string): string {
  if (!isoString) return 'N/A';
  
  const date = new Date(isoString);
  
  // Use UTC methods to ensure server/client consistency
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  return `${day}-${month}-${year}`;
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return 'N/A';
  
  const date = new Date(isoString);
  
  // Use UTC methods
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

export function formatDateShort(isoString: string): string {
  if (!isoString) return 'N/A';
  
  const date = new Date(isoString);
  
  // Use UTC methods
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear()).toString().slice(-2); // Last 2 digits
  
  return `${day}/${month}/${year}`;
}


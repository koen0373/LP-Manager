/**
 * Utility for timing fetch requests and logging performance metrics
 */

interface FetchTiming {
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  error?: string;
}

const activeRequests = new Map<string, FetchTiming>();

export function logFetchStart(url: string, method: string = 'GET'): string {
  const requestId = `${method}:${url}:${Date.now()}`;
  const timing: FetchTiming = {
    url,
    method,
    startTime: Date.now(),
  };
  
  activeRequests.set(requestId, timing);
  // Only log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[FETCH START] ${method} ${url}`);
  }
  
  return requestId;
}

export function logFetchEnd(requestId: string, status?: number, error?: string): void {
  const timing = activeRequests.get(requestId);
  if (!timing) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[FETCH END] Unknown request ID: ${requestId}`);
    }
    return;
  }
  
  timing.endTime = Date.now();
  timing.duration = timing.endTime - timing.startTime;
  timing.status = status;
  timing.error = error;
  
  // Only log errors in production, everything in development
  if (process.env.NODE_ENV === 'development' || error || (status && status >= 400)) {
    const statusText = status ? ` ${status}` : '';
    const errorText = error ? ` ERROR: ${error}` : '';
    console.log(`[FETCH END] ${timing.method} ${timing.url}${statusText} - ${timing.duration}ms${errorText}`);
  }
  
  activeRequests.delete(requestId);
}

export async function timedFetch(url: string, options?: RequestInit): Promise<Response> {
  const method = options?.method || 'GET';
  const requestId = logFetchStart(url, method);
  
  try {
    // Convert relative URLs to absolute URLs
    const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const response = await fetch(absoluteUrl, options);
    logFetchEnd(requestId, response.status);
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logFetchEnd(requestId, undefined, errorMessage);
    throw error;
  }
}

export function getActiveRequests(): FetchTiming[] {
  return Array.from(activeRequests.values());
}

export function clearActiveRequests(): void {
  activeRequests.clear();
}

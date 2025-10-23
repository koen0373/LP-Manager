"use strict";
/**
 * Utility for timing fetch requests and logging performance metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logFetchStart = logFetchStart;
exports.logFetchEnd = logFetchEnd;
exports.timedFetch = timedFetch;
exports.getActiveRequests = getActiveRequests;
exports.clearActiveRequests = clearActiveRequests;
const activeRequests = new Map();
function logFetchStart(url, method = 'GET') {
    const requestId = `${method}:${url}:${Date.now()}`;
    const timing = {
        url,
        method,
        startTime: Date.now(),
    };
    activeRequests.set(requestId, timing);
    console.log(`[FETCH START] ${method} ${url}`);
    return requestId;
}
function logFetchEnd(requestId, status, error) {
    const timing = activeRequests.get(requestId);
    if (!timing) {
        console.warn(`[FETCH END] Unknown request ID: ${requestId}`);
        return;
    }
    timing.endTime = Date.now();
    timing.duration = timing.endTime - timing.startTime;
    timing.status = status;
    timing.error = error;
    const statusText = status ? ` ${status}` : '';
    const errorText = error ? ` ERROR: ${error}` : '';
    console.log(`[FETCH END] ${timing.method} ${timing.url}${statusText} - ${timing.duration}ms${errorText}`);
    activeRequests.delete(requestId);
}
async function timedFetch(url, options) {
    const method = options?.method || 'GET';
    const requestId = logFetchStart(url, method);
    try {
        // Convert relative URLs to absolute URLs
        const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
        const response = await fetch(absoluteUrl, options);
        logFetchEnd(requestId, response.status);
        return response;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logFetchEnd(requestId, undefined, errorMessage);
        throw error;
    }
}
function getActiveRequests() {
    return Array.from(activeRequests.values());
}
function clearActiveRequests() {
    activeRequests.clear();
}

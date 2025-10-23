"use strict";
// src/lib/data/apsRewards.ts
// Temporarily disabled APS rewards fetching to improve performance
// This file contains the infrastructure but is not currently active
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApsRewardForPosition = getApsRewardForPosition;
exports.getClaimableAps = getClaimableAps;
exports.clearApsRewardCache = clearApsRewardCache;
async function getApsRewardForPosition(_tokenId) {
    // Temporarily disabled to improve performance
    void _tokenId;
    return null;
}
async function getClaimableAps(_tokenId) {
    // Temporarily disabled to improve performance
    void _tokenId;
    return null;
}
function clearApsRewardCache() {
    // Temporarily disabled to improve performance
    console.log('[APS] Cache clear requested but APS rewards are disabled');
}

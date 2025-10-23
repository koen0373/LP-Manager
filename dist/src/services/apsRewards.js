"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearApsRewardCache = void 0;
exports.getApsRewardForPosition = getApsRewardForPosition;
const apsRewards_1 = require("../lib/data/apsRewards");
Object.defineProperty(exports, "clearApsRewardCache", { enumerable: true, get: function () { return apsRewards_1.clearApsRewardCache; } });
async function getApsRewardForPosition(positionId) {
    return await (0, apsRewards_1.getClaimableAps)(positionId);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenPrice = getTokenPrice;
exports.getTokenPriceByAddress = getTokenPriceByAddress;
exports.getTokenPriceForRewards = getTokenPriceForRewards;
exports.getTokenPrices = getTokenPrices;
exports.calculateUsdValue = calculateUsdValue;
exports.clearPriceCache = clearPriceCache;
const tokenRegistry_1 = require("./tokenRegistry");
const memo_1 = require("../lib/util/memo");
const withTimeout_1 = require("../lib/util/withTimeout");
// Legacy function for backward compatibility - now uses token registry
async function getTokenPrice(symbol) {
    return (0, memo_1.memoize)(`token-price-${symbol}`, async () => {
        // Map legacy symbols to addresses for the registry
        const symbolToAddress = {
            'RFLR': '0x0000000000000000000000000000000000000000', // Placeholder for RFLR rewards
            'WFLR': '0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d',
            'USD0': '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
            'USDTO': '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
            'USDT0': '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
            'EUSDT': '0x96B41289D90444B8adD57e6F265DB5aE8651DF29',
            'FXRP': '0xAd552A648C74D49E10027AB8a618A3ad4901c5bE',
            'APS': '0xfF56Eb5b1a7FAa972291117E5E9565dA29bc808d',
        };
        const normalizedSymbol = symbol
            .normalize("NFKD")
            .replace(/[^A-Z0-9]/gi, "")
            .toUpperCase();
        console.log(`[PRICE] Getting price for symbol: "${symbol}" -> normalized: "${normalizedSymbol}"`);
        const address = symbolToAddress[normalizedSymbol];
        if (!address) {
            console.warn(`[PRICE] No address mapping found for symbol: ${symbol}`);
            return 0;
        }
        try {
            const price = await (0, withTimeout_1.withTimeout)((0, tokenRegistry_1.getUsdPriceNow)(address), 10000, `Price fetch for ${symbol} timed out`);
            console.log(`[PRICE] Price for ${symbol}: $${price}`);
            return price;
        }
        catch (error) {
            console.warn(`[PRICE] Failed to get price for ${symbol}:`, error);
            return 0;
        }
    }, 60 * 1000); // 1 minute cache for token prices
}
// New function for getting prices by address (recommended)
async function getTokenPriceByAddress(address) {
    try {
        return await (0, tokenRegistry_1.getUsdPriceNow)(address);
    }
    catch (error) {
        console.warn(`[PRICE] Failed to get price for address ${address}:`, error);
        return 0;
    }
}
// Rewards-specific function with shorter cache TTL
async function getTokenPriceForRewards(symbol) {
    return (0, memo_1.memoize)(`rewards-price-${symbol}`, async () => {
        // Use the same logic as getTokenPrice but with more aggressive caching
        return getTokenPrice(symbol);
    }, 30 * 1000); // 30 second cache for rewards prices
}
// Batch price fetching
async function getTokenPrices(symbols) {
    return (0, memo_1.memoize)(`batch-prices-${symbols.sort().join(',')}`, async () => {
        const prices = {};
        // Fetch all prices in parallel
        const pricePromises = symbols.map(async (symbol) => {
            const price = await getTokenPrice(symbol);
            return { symbol: symbol.toUpperCase(), price };
        });
        const results = await Promise.all(pricePromises);
        for (const { symbol, price } of results) {
            prices[symbol] = price;
        }
        return prices;
    }, 60 * 1000); // 1 minute cache for batch prices
}
// Helper to calculate USD value
function calculateUsdValue(amount, decimals, price) {
    const divisor = BigInt(10 ** decimals);
    const amountFloat = Number(amount) / Number(divisor);
    return amountFloat * price;
}
// Clear cache function for testing
function clearPriceCache() {
    (0, tokenRegistry_1.clearPriceCache)();
}

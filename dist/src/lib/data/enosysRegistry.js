"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGISTRY_KEYS = exports.REGISTRY = void 0;
exports.resolveContractFromRegistry = resolveContractFromRegistry;
exports.resolveAnyRewardsContract = resolveAnyRewardsContract;
// src/lib/data/enosysRegistry.ts
const viem_1 = require("viem");
const client = (0, viem_1.createPublicClient)({
    transport: (0, viem_1.http)(process.env.NEXT_PUBLIC_RPC_URL ?? 'https://flare.flr.finance/ext/bc/C/rpc'),
});
exports.REGISTRY = '0xaD67FE666660Fb8dFE9d6b1b4240d8650e30F6019';
// Kandidaten die we in de registry kunnen proberen
const ABI_VARIANTS = [
    // string varianten
    {
        fn: 'getContractAddress',
        abi: ['function getContractAddress(string) view returns (address)'],
        args: (k) => [k],
    },
    {
        fn: 'contracts',
        abi: ['function contracts(string) view returns (address)'],
        args: (k) => [k],
    },
    // bytes32 varianten
    {
        fn: 'getContractAddressByHash',
        abi: ['function getContractAddressByHash(bytes32) view returns (address)'],
        args: (k) => [(0, viem_1.keccak256)((0, viem_1.toHex)(k))],
    },
    {
        fn: 'contracts',
        abi: ['function contracts(bytes32) view returns (address)'],
        args: (k) => [(0, viem_1.keccak256)((0, viem_1.toHex)(k))],
    },
];
// Fallback voor als geen van de ABI-varianten werkt: raw eth_call met selector
const RAW_SELECTORS = [
    { sig: 'getContractAddress(bytes32)', selector: '0x0b1889f2' }, // keccak4('getContractAddress(bytes32)')
    { sig: 'getContractAddressByHash(bytes32)', selector: '0x4fc57a21' }, // keccak4(...)
    { sig: 'contracts(bytes32)', selector: '0x4e6213ee' },
];
// helper: decode 32-byte result in address
function decodeAddress(ret) {
    if (!ret || ret.length < 2 + 64)
        return '0x0000000000000000000000000000000000000000';
    const addr = '0x' + ret.slice(-40);
    return addr;
}
exports.REGISTRY_KEYS = [
    'IncentivesController',
    'RewardsDistributor',
    'Incentives',
    'FarmingManager',
    'LiquidityMining',
    'RewardManager', // Toegevoegd gebaseerd op Enosys code
    'EnosysRewardManager', // Mogelijke variant
    'DexRewardManager', // Mogelijke variant
];
/** Probeert alle varianten totdat er een geldig adres terugkomt */
async function resolveContractFromRegistry(key) {
    // 1) probeer ABI varianten
    for (const v of ABI_VARIANTS) {
        try {
            const addr = await client.readContract({
                address: exports.REGISTRY,
                abi: v.abi,
                functionName: v.fn,
                args: v.args(key),
            });
            if (addr && addr !== '0x0000000000000000000000000000000000000000')
                return addr;
        }
        catch { }
    }
    // 2) raw call fallback (eth_call zonder ABI)
    const arg = (0, viem_1.keccak256)((0, viem_1.toHex)(key)); // bytes32
    const padded = '0'.repeat(64 - arg.slice(2).length) + arg.slice(2); // links pad
    for (const r of RAW_SELECTORS) {
        try {
            const data = (r.selector + padded);
            const ret = await client.call({ to: exports.REGISTRY, data });
            const addr = decodeAddress(ret.data);
            if (addr && addr !== '0x0000000000000000000000000000000000000000')
                return addr;
        }
        catch { }
    }
    throw new Error(`Registry gaf geen adres terug voor key "${key}" (probeer andere sleutel of check implementation ABI).`);
}
/** Convenience: zoekt de eerste geldige rewards/incentives contract key */
async function resolveAnyRewardsContract() {
    for (const k of exports.REGISTRY_KEYS) {
        try {
            const a = await resolveContractFromRegistry(k);
            return { key: k, address: a };
        }
        catch { }
    }
    throw new Error('Geen rewards/incentives contract gevonden via registry');
}

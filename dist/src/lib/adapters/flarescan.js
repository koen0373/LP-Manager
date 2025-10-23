"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractCreation = getContractCreation;
exports.getNftTransfers = getNftTransfers;
exports.getContractSourceCode = getContractSourceCode;
const zod_1 = require("zod");
const rateLimit_1 = require("./rateLimit");
const FLARESCAN_BASE_URL = 'https://flarescan.com/api';
const API_KEY = process.env.FLARESCAN_API_KEY || 'placeholder';
const flarescanResponseSchema = zod_1.z.object({
    status: zod_1.z.string(),
    message: zod_1.z.string().optional(),
    result: zod_1.z.any(),
});
async function flarescanGet({ params, description, emptyValue, }) {
    const url = new URL(FLARESCAN_BASE_URL);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    url.searchParams.set('apikey', API_KEY);
    const response = await (0, rateLimit_1.rateLimitedFetch)({
        description,
        request: () => fetch(url.toString(), { method: 'GET' }),
    });
    if (!response.ok) {
        throw new Error(`[Flarescan] ${description} failed with status ${response.status}`);
    }
    const json = flarescanResponseSchema.parse(await response.json());
    if (json.status === '1') {
        return json.result;
    }
    const message = json.message?.toLowerCase() ?? '';
    if (message.includes('no') || message.includes('not found')) {
        return emptyValue;
    }
    throw new Error(`[Flarescan] ${description} failed: ${json.message ?? 'Unknown error'}`);
}
async function getContractCreation(contractAddress) {
    const result = await flarescanGet({
        params: {
            module: 'contract',
            action: 'getcontractcreation',
            contractaddresses: contractAddress,
        },
        description: `contract creation for ${contractAddress}`,
        emptyValue: [],
    });
    return result.length > 0 ? result[0] : null;
}
async function getNftTransfers(nftContract, tokenId, options = {}) {
    const pageSize = options.pageSize ?? 100;
    const sort = options.sort ?? 'asc';
    const maxPages = options.maxPages ?? 100; // safety guard
    const transfers = [];
    for (let page = 1; page <= maxPages; page += 1) {
        const chunk = await flarescanGet({
            params: {
                module: 'account',
                action: 'tokennfttx',
                contractaddress: nftContract,
                tokenid: tokenId,
                page: String(page),
                offset: String(pageSize),
                sort,
            },
            description: `NFT transfers for ${nftContract} token ${tokenId} (page ${page})`,
            emptyValue: [],
        });
        if (chunk.length === 0) {
            break;
        }
        transfers.push(...chunk);
        if (chunk.length < pageSize) {
            break;
        }
    }
    return transfers;
}
async function getContractSourceCode(contractAddress) {
    const result = await flarescanGet({
        params: {
            module: 'contract',
            action: 'getsourcecode',
            address: contractAddress,
        },
        description: `contract source for ${contractAddress}`,
        emptyValue: [],
    });
    return result.length > 0 ? result[0] : null;
}

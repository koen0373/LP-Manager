"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flare = void 0;
const viem_1 = require("viem");
exports.flare = (0, viem_1.defineChain)({
    id: 14,
    name: 'Flare',
    nativeCurrency: {
        decimals: 18,
        name: 'Flare',
        symbol: 'FLR',
    },
    rpcUrls: {
        default: {
            http: [
                'https://flare.flr.finance/ext/bc/C/rpc',
                'https://flare.public-rpc.com',
            ],
        },
        public: {
            http: [
                'https://flare.flr.finance/ext/bc/C/rpc',
                'https://flare.public-rpc.com',
            ],
        },
    },
    blockExplorers: {
        default: {
            name: 'FlareScan',
            url: 'https://flare.space',
        },
    },
    testnet: false,
});

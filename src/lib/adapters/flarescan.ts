import { z } from 'zod';
import { rateLimitedFetch } from './rateLimit';

const FLARESCAN_BASE_URL = 'https://flarescan.com/api';
const API_KEY = process.env.FLARESCAN_API_KEY || 'placeholder';

const flarescanResponseSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
  result: z.any(),
});

export type FlarescanContractCreation = {
  contractAddress: string;
  contractCreator: string;
  txHash: string;
};

export type FlarescanTokenNftTx = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  tokenID: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
};

export type FlarescanSourceCodeEntry = {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments: string;
  EVMVersion: string;
  Library: string;
  LicenseType: string;
  Proxy: string;
  Implementation: string;
  SwarmSource: string;
};

interface FlarescanGetOptions<T> {
  params: Record<string, string>;
  description: string;
  emptyValue: T;
}

async function flarescanGet<T>({
  params,
  description,
  emptyValue,
}: FlarescanGetOptions<T>): Promise<T> {
  const url = new URL(FLARESCAN_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('apikey', API_KEY);

  const response = await rateLimitedFetch({
    description,
    request: () => fetch(url.toString(), { 
      method: 'GET',
      headers: {
        'User-Agent': 'LiquiLP/1.0',
        'Accept': 'application/json',
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`[Flarescan] ${description} failed with status ${response.status}`);
  }

  const json = flarescanResponseSchema.parse(await response.json());
  if (json.status === '1') {
    return json.result as T;
  }

  const message = json.message?.toLowerCase() ?? '';
  if (message.includes('no') || message.includes('not found')) {
    return emptyValue;
  }

  throw new Error(`[Flarescan] ${description} failed: ${json.message ?? 'Unknown error'}`);
}

export async function getContractCreation(
  contractAddress: string
): Promise<FlarescanContractCreation | null> {
  const result = await flarescanGet<FlarescanContractCreation[]>({
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

interface GetNftTransferOptions {
  pageSize?: number;
  sort?: 'asc' | 'desc';
  maxPages?: number;
}

export async function getNftTransfers(
  nftContract: string,
  tokenId: string,
  options: GetNftTransferOptions = {}
): Promise<FlarescanTokenNftTx[]> {
  const pageSize = options.pageSize ?? 100;
  const sort = options.sort ?? 'asc';
  const maxPages = options.maxPages ?? 100; // safety guard
  const transfers: FlarescanTokenNftTx[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const chunk = await flarescanGet<FlarescanTokenNftTx[]>({
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

export async function getContractSourceCode(
  contractAddress: string
): Promise<FlarescanSourceCodeEntry | null> {
  const result = await flarescanGet<FlarescanSourceCodeEntry[]>({
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


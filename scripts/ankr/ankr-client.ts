type JsonRpcParams = Record<string, unknown>;

type NFTTransfer = {
  blockchain: string;
  contractAddress: string;
  tokenId: string;
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  blockNumber: string;
  logIndex: string;
  timestamp: string;
};

type NFTTransferResponse = {
  transfers: NFTTransfer[];
  nextPageToken?: string;
};

export type AnkrClientConfig = {
  apiKey: string;
  baseUrl?: string;
};

export class AnkrClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: AnkrClientConfig) {
    if (!config.apiKey) {
      throw new Error('ANKR API key missing');
    }
    this.apiKey = config.apiKey;
    this.baseUrl =
      config.baseUrl && config.baseUrl.length > 0
        ? config.baseUrl
        : `https://flare-api.flare.network/ext/C/rpc
  }

  private async request<T>(method: string, params: JsonRpcParams): Promise<T> {
    const body = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`ANKR request failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();

    if (payload.error) {
      throw new Error(`ANKR error: ${payload.error.message ?? 'unknown error'}`);
    }

    return payload.result as T;
  }

  async getNFTTransfers(options: {
    blockchain: string;
    contractAddress: string;
    pageToken?: string;
    pageSize?: number;
  }): Promise<NFTTransferResponse> {
    const result = await this.request<NFTTransferResponse>('ankr_getNFTTransfers', {
      blockchain: options.blockchain,
      contractAddress: options.contractAddress,
      pageToken: options.pageToken,
      pageSize: options.pageSize ?? 100,
      orderBy: 'DESC',
    });

    return result;
  }
}

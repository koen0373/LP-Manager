export type GetNFTTransfersParams = {
  blockchain: string;
  contractAddress: string;
  pageToken?: string;
  pageSize?: number;
};

export type NFTTransfer = {
  tokenId: string;
  transactionHash: string;
  logIndex: string | number;
  blockNumber: string | number;
  timestamp: string | number;
  fromAddress?: string;
  toAddress?: string;
};

export default class AnkrClient {
  private endpoint: string;
  constructor(opts: { apiKey?: string; advancedUrl?: string }) {
    const { apiKey, advancedUrl } = opts ?? {};
    this.endpoint = (advancedUrl && advancedUrl.trim())
      || (apiKey ? `https://rpc.ankr.com/multichain/${apiKey}` : '');
    if (!this.endpoint) throw new Error('ANKR Advanced API endpoint missing');
  }
  async getNFTTransfers(params: GetNFTTransfersParams): Promise<{ transfers: NFTTransfer[]; nextPageToken?: string }> {
    const body = { jsonrpc:'2.0', id:1, method:'ankr_getNFTTransfers',
      params:{ blockchain: params.blockchain, contractAddress: params.contractAddress, pageSize: params.pageSize ?? 1000, pageToken: params.pageToken } };
    const res = await fetch(this.endpoint, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`ANKR HTTP ${res.status}: ${await res.text().catch(()=> '')}`);
    const json:any = await res.json();
    if (json.error) throw new Error(`ANKR RPC error: ${JSON.stringify(json.error)}`);
    const r = json.result ?? {};
    return { transfers: Array.isArray(r.transfers)? r.transfers : [], nextPageToken: r.nextPageToken };
  }
}

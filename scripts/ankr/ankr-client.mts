// ESM ANKR client – accepteert zowel baseUrl (alias) als advancedUrl; named + default export.
type Json = Record<string, unknown>;

export class AnkrClient {
  private advUrl: string;

  constructor(opts?: { advancedUrl?: string; baseUrl?: string; apiKey?: string }) {
    const envKey  = process.env.ANKR_API_KEY ?? '';
    const envAdv  = process.env.ANKR_ADVANCED_API_URL || (envKey ? `https://rpc.ankr.com/multichain/${envKey}` : '');
    const passed  = opts?.advancedUrl || opts?.baseUrl || '';
    this.advUrl   = (passed && passed.replace(/\s+$/,'')) || envAdv;
    if (!this.advUrl) throw new Error('ANKR Advanced API URL ontbreekt. Zet ANKR_API_KEY of ANKR_ADVANCED_API_URL in .env.local');
  }

  private async call<T=Json>(method: string, params: Json): Promise<T> {
    const res = await fetch(this.advUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(()=>'<no body>')}`);
    const j = await res.json() as { result?: T; error?: Json };
    if (j.error) throw new Error(`ANKR error: ${JSON.stringify(j.error)}`);
    if (!('result' in j)) throw new Error('Lege ANKR response (result ontbreekt)');
    return j.result as T;
  }

  async getNFTsByOwner(args:{ walletAddress:string; blockchain?:string; pageSize?:number; pageToken?:string }) {
    const { walletAddress, blockchain='flare', pageSize=1000, pageToken } = args;
    return this.call('ankr_getNFTsByOwner', { walletAddress, blockchain, pageSize, pageToken });
  }

  async getTransfersByAddress(args:{ walletAddress:string; blockchain?:string; pageSize?:number; pageToken?:string }) {
    const { walletAddress, blockchain='flare', pageSize=1000, pageToken } = args;
    return this.call('ankr_getTransfersByAddress', { walletAddress, blockchain, pageSize, pageToken });
  }

  async getTokenPrice(args:{ blockchain?:string; contractAddress:string; unit?:string }) {
    const { blockchain='flare', contractAddress, unit='usd' } = args;
    return this.call('ankr_getTokenPrice', { blockchain, contractAddress, unit });
  }
}
export default AnkrClient;

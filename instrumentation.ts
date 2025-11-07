export async function register() {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: any) => {
    let url = typeof input === 'string' ? input : (input?.url ?? '');
    if (typeof url === 'string' && url.includes('rpc.ankr.com')) {
      const replaced = url.replace(/https:\/\/rpc\.ankr\.com\/[a-zA-Z0-9_-]*/g, 'https://flare-api.flare.network/ext/C/rpc');
      console.log('[instrumentation] Redirecting ANKR → FLARE RPC:', replaced);
      url = replaced;
    }
    return origFetch(url as any, init);
  };
  console.log('[instrumentation] ANKR replaced with Flare RPC');
}

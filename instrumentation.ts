export async function register(): Promise<void> {
  const origFetch = globalThis.fetch;

  const rewriteUrl = (url: string): string => {
    if (!url.includes('rpc.ankr.com')) {
      return url;
    }
    const replaced = url.replace(
      /https:\/\/rpc\.ankr\.com\/[a-zA-Z0-9_-]*/g,
      'https://flare-api.flare.network/ext/C/rpc',
    );
    console.log('[instrumentation] Redirecting ANKR → FLARE RPC:', replaced);
    return replaced;
  };

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return origFetch(rewriteUrl(input), init);
    }

    if (input instanceof URL) {
      return origFetch(new URL(rewriteUrl(input.toString())), init);
    }

    if (input instanceof Request) {
      const updatedUrl = rewriteUrl(input.url);
      if (updatedUrl !== input.url) {
        const cloned = new Request(updatedUrl, input);
        return origFetch(cloned, init);
      }
    }

    return origFetch(input, init);
  };

  console.log('[instrumentation] ANKR replaced with Flare RPC');
}

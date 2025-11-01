export default {
  // No-op async storage shim for web bundling.
  // MetaMask SDK may import React Native storage in its browser bundle; stubbing avoids build-time resolution warnings.
  async getItem(_key: string): Promise<string | null> {
    return null;
  },
  async setItem(_key: string, _value: string): Promise<void> {
    // no-op
  },
  async removeItem(_key: string): Promise<void> {
    // no-op
  },
  async clear(): Promise<void> {
    // no-op
  },
};

/**
 * Web stub voor @react-native-async-storage/async-storage
 * Exporteert een default object met AsyncStorage-achtige API.
 */
type V = string | null;
const store = new Map<string, string>();
const AsyncStorage = {
  async getItem(key: string): Promise<V> {
    return store.has(key) ? store.get(key)! : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  async clear(): Promise<void> {
    store.clear();
  },
  async getAllKeys(): Promise<string[]> {
    return Array.from(store.keys());
  },
  async multiGet(keys: string[]): Promise<[string, V][]> {
    return keys.map((k) => [k, store.get(k) ?? null]);
  },
  async multiSet(entries: [string, string][]): Promise<void> {
    entries.forEach(([k, v]) => store.set(k, v));
  },
};
export default AsyncStorage;

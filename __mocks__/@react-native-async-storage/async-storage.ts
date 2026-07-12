// Manual Jest mock for @react-native-async-storage/async-storage — an
// in-memory Map standing in for the native persistence layer.
const store = new Map<string, string>();

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => (store.has(key) ? store.get(key)! : null),
  setItem: async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    store.delete(key);
  },
  clear: async (): Promise<void> => {
    store.clear();
  },
};

export default AsyncStorage;

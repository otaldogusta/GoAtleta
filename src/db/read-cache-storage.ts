import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys are already scoped by client.ts. Auth, preferences and pending writes do
// not use this adapter; the native cache keeps its existing AsyncStorage path.
export const getReadCacheItem = (key: string): Promise<string | null> => AsyncStorage.getItem(key);
export const setReadCacheItem = (key: string, value: string): Promise<void> => AsyncStorage.setItem(key, value);
export const removeReadCacheItem = (key: string): Promise<void> => AsyncStorage.removeItem(key);

// client.ts removes native read-cache prefixes directly from AsyncStorage.
export async function clearReadCacheStorage(): Promise<void> {}

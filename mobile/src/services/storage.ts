import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

/**
 * Cross-platform key/value storage.
 * - Native (iOS/Android): expo-secure-store (Keychain / Keystore)
 * - Web: localStorage (SecureStore n'existe pas sur web)
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    if (isWeb) {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

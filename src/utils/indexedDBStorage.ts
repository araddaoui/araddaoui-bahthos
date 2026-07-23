import { get, set, del, keys } from "idb-keyval";

export async function getStoredItem<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const val = await get<T>(key);
    if (val !== undefined && val !== null) {
      return val;
    }
    // Fallback to localStorage if not in idb-keyval yet
    const localVal = localStorage.getItem(key);
    if (localVal) {
      const parsed = JSON.parse(localVal);
      // Migrate to IndexedDB
      await set(key, parsed).catch(() => {});
      return parsed;
    }
  } catch (e) {
    console.error(`Failed to read key ${key} from IndexedDB:`, e);
    // Secondary fallback
    try {
      const localVal = localStorage.getItem(key);
      if (localVal) return JSON.parse(localVal);
    } catch (_) {}
  }
  return defaultValue;
}

export async function setStoredItem<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, value);
  } catch (e) {
    console.error(`Failed to write key ${key} to IndexedDB:`, e);
  }

  // Also try updating localStorage if within quota limit
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // Ignore localStorage QuotaExceededError since IndexedDB holds the primary state
  }
}

export async function removeStoredItem(key: string): Promise<void> {
  try {
    await del(key);
  } catch (e) {
    console.error(`Failed to delete key ${key} from IndexedDB:`, e);
  }
  try {
    localStorage.removeItem(key);
  } catch (_) {}
}

export async function clearStoredPrefix(prefix: string): Promise<void> {
  try {
    const allKeys = await keys();
    for (const k of allKeys) {
      if (typeof k === "string" && k.startsWith(prefix)) {
        await del(k);
      }
    }
  } catch (e) {
    console.error(`Failed to clear prefix ${prefix} from IndexedDB:`, e);
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}

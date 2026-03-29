/**
 * Evolve Strong - Cache System
 * Engineered for high-availability and offline-first workout tracking.
 */

const CACHE_PREFIX = "evolve_cache_";
const EXPIRY_TIME = 1000 * 60 * 30; // 30 minutos de vida por padrão

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export const cache = {
  set: <T>(key: string, data: T) => {
    try {
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (e) {
      console.warn("Cache write failed:", e);
    }
  },

  get: <T>(key: string): T | null => {
    try {
      const stored = localStorage.getItem(CACHE_PREFIX + key);
      if (!stored) return null;

      const item: CacheItem<T> = JSON.parse(stored);
      // Validar expiração (opcional para dados de treino cruciais)
      if (Date.now() - item.timestamp > EXPIRY_TIME) {
        // localStorage.removeItem(CACHE_PREFIX + key);
        // return null;
      }
      return item.data;
    } catch (e) {
      return null;
    }
  },

  remove: (key: string) => {
    localStorage.removeItem(CACHE_PREFIX + key);
  },

  clear: () => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  },
};

/**
 * LocalStorage keys used throughout the application
 * Centralized configuration for easy maintenance and updates
 */
export const STORAGE_KEYS = {
  /** Key for storing the currently logged-in user */
  CURRENT_USER: 'ha-logged-in-user',
  /** Key for storing all logged-in users */
  LOGGED_IN_USERS: 'ha-logged-in-users',
  /** Legacy key for auth storage (used in cleanup) */
  LEGACY_AUTH_STORAGE: 'auth-storage',
  /** Legacy key for encrypted hive auth (used in cleanup) */
  LEGACY_HIVE_AUTH_ENCRYPTED: 'hive-auth-encrypted',
} as const;

/**
 * Type for storage keys to ensure type safety
 */
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

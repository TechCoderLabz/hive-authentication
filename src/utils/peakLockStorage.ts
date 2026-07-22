import CryptoJS from 'crypto-js';

export interface PeakLockAccount {
  username: string;
  encryptedKey: string;
  publicKey?: string;
}

const PEAKLOCK_STORAGE_KEY = 'hive_auth_peaklock_accounts';

export const getPeakLockAccounts = (): PeakLockAccount[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PEAKLOCK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse PeakLock accounts:', error);
    return [];
  }
};

export const savePeakLockAccount = (
  username: string,
  postingKey: string,
  pin: string,
  publicKey?: string
): PeakLockAccount[] => {
  if (typeof window === 'undefined') return [];
  const cleanUsername = username.trim().toLowerCase();
  const encryptedKey = CryptoJS.AES.encrypt(postingKey.trim(), pin).toString();
  
  const accounts = getPeakLockAccounts().filter((acc) => acc.username !== cleanUsername);
  const newAccount: PeakLockAccount = {
    username: cleanUsername,
    encryptedKey,
    publicKey,
  };
  
  const updated = [...accounts, newAccount];
  localStorage.setItem(PEAKLOCK_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const decryptPeakLockKey = (encryptedKey: string, pin: string): string | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, pin);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted || decrypted.trim() === '') return null;
    return decrypted.trim();
  } catch (error) {
    console.error('Failed to decrypt PeakLock key with PIN:', error);
    return null;
  }
};

export const removePeakLockAccount = (username: string): PeakLockAccount[] => {
  if (typeof window === 'undefined') return [];
  const cleanUsername = username.trim().toLowerCase();
  const accounts = getPeakLockAccounts().filter((acc) => acc.username !== cleanUsername);
  localStorage.setItem(PEAKLOCK_STORAGE_KEY, JSON.stringify(accounts));
  return accounts;
};

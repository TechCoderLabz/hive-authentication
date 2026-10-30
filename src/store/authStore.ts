/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import CryptoJS from 'crypto-js';
import type { AuthStore, LoggedInUser } from '../types/auth';
import { STORAGE_KEYS } from '../constants/storage';
import { PlaintextKeyProvider } from '@aioha/aioha/build/providers/custom/plaintext';
import { KeyTypes, Providers } from '@aioha/aioha/build/types';

// Encryption/Decryption helpers (use encryptionKey passed to AuthButton)
const encryptData = (data: unknown, key: string): string => {
  if (!data || !key || key === '') return '';
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
};

const decryptData = (encryptedData: string, key: string): unknown => {
  if (!encryptedData || !key || key === '') return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    return null;
  }
};

// Clean up old storage keys
const cleanupOldStorage = () => {
  if (typeof window !== 'undefined') {
    safeStorageRemoveItem(STORAGE_KEYS.LEGACY_AUTH_STORAGE);
    safeStorageRemoveItem(STORAGE_KEYS.LEGACY_HIVE_AUTH_ENCRYPTED);
  }
};

const safeStorageSetItem = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (err: any) {
    console.warn(`LocalStorage setItem failed for key "${key}":`, err);
    // If quota exceeded, attempt to clear transient cache keys and retry
    if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
      try {
        const transientKeys = [
          'hive-community-cache',
          'hive-custom-snaps-pinned',
          'hive-custom-snaps-interests',
          'hive-drive-files',
        ];
        transientKeys.forEach((k) => {
          try {
            localStorage.removeItem(k);
          } catch {
            // ignore
          }
        });
        localStorage.setItem(key, value);
      } catch (retryErr) {
        console.error(`LocalStorage quota exceeded even after eviction for key "${key}":`, retryErr);
      }
    }
  }
};

const safeStorageRemoveItem = (key: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`LocalStorage removeItem failed for key "${key}":`, err);
  }
};

// Initialize state from localStorage
const initializeState = (secretKey: string): { currentUser: LoggedInUser | null; loggedInUsers: LoggedInUser[] } => {
  if (typeof window === 'undefined' || !secretKey || secretKey === '') return { currentUser: null, loggedInUsers: [] };
  
  try {
    const encryptedUsers = localStorage.getItem(STORAGE_KEYS.LOGGED_IN_USERS);
    const encryptedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    
    const users = encryptedUsers ? decryptData(encryptedUsers, secretKey) : [];
    const currentUser = encryptedCurrentUser ? decryptData(encryptedCurrentUser, secretKey) : null;
    
    // Type guard to ensure we have the correct types
    const typedUsers = Array.isArray(users) ? users.filter((user): user is LoggedInUser => 
      user && typeof user === 'object' && 'username' in user
    ) : [];
    
    const typedCurrentUser = currentUser && typeof currentUser === 'object' && 'username' in currentUser 
      ? currentUser as LoggedInUser 
      : null;
    
    return { currentUser: typedCurrentUser, loggedInUsers: typedUsers };
  } catch (error) {
    console.error('Failed to initialize auth state:', error);
    return { currentUser: null, loggedInUsers: [] };
  }
};

export const useAuthStore = create<AuthStore>((set, get) => {
  // Initialize state
  const initialState = initializeState('');
  cleanupOldStorage();
  
  return {
    ...initialState,
    isLoading: false,
    error: null,
    hiveAuthPayload: null,
    secretKey: null,
    aioha: null,
    setHiveAuthPayload: (payload) => set({ hiveAuthPayload: payload }),
    setLoading: (loading) => set({ isLoading: loading }),
    setSecretKey: (secretKey) => { 
      set({ secretKey });
      const restored = initializeState(secretKey || '');
      set({ currentUser: restored.currentUser, loggedInUsers: restored.loggedInUsers });
    },
    setAioha: (aioha) => set({ aioha }),
    switchToActiveForCurrentUser: async () => {
      const { currentUser, aioha } = get();
      if (!currentUser?.username) return;
      if (!aioha) return;
      if (!currentUser.privateActiveKey) return;
      const plaintextProvider = new PlaintextKeyProvider(currentUser.privateActiveKey);
      aioha.registerCustomProvider(plaintextProvider);
      const timestamp = new Date().toISOString();
      await aioha.login(Providers.Custom, currentUser.username, {
        msg: timestamp,
        keyType: KeyTypes.Active
      });
    },
    switchToPostingForCurrentUser: async () => {
      const { currentUser, aioha } = get();
      if (!currentUser?.username) return;
      if (!aioha) return;
      if (!currentUser.privatePostingKey) return;
      const plaintextProvider = new PlaintextKeyProvider(currentUser.privatePostingKey);
      aioha.registerCustomProvider(plaintextProvider);
      const timestamp = new Date().toISOString();
      await aioha.login(Providers.Custom, currentUser.username, {
        msg: timestamp,
        keyType: KeyTypes.Posting
      });
    },
    setError: (error) => set({ error }),
    
    setCurrentUser: (user) => {
      // Encrypt and store
      if (user) {
        const encryptedUser = encryptData(user, get().secretKey || '');
        safeStorageSetItem(STORAGE_KEYS.CURRENT_USER, encryptedUser);
      } else {
        safeStorageRemoveItem(STORAGE_KEYS.CURRENT_USER);
      }
      
      set({ currentUser: user });
    },
    
    addLoggedInUser: (user) => {
      const { loggedInUsers } = get();
      const updatedUsers = [
        ...loggedInUsers.filter((u) => {
          if (u.loginType === 'web2' && user.loginType === 'web2') {
            if (u.uid && user.uid) return u.uid !== user.uid;
            if (u.email && user.email) return u.email.toLowerCase() !== user.email.toLowerCase();
          }
          if (u.loginType === 'web3' && user.loginType === 'web3') {
            if (u.address && user.address) return u.address.toLowerCase() !== user.address.toLowerCase();
          }
          return u.username.trim().toLowerCase() !== user.username.trim().toLowerCase();
        }),
        user,
      ];
      
      // Encrypt and store
      const encryptedUsers = encryptData(updatedUsers, get().secretKey || '');
      safeStorageSetItem(STORAGE_KEYS.LOGGED_IN_USERS, encryptedUsers);
      
      set({ loggedInUsers: updatedUsers });
    },
    
    removeLoggedInUser: async (username) => {
      const { loggedInUsers, currentUser } = get();
      const cleanUser = username.trim().toLowerCase();
      const updatedUsers = loggedInUsers.filter((u) => {
        if (u.uid && u.uid.toLowerCase() === cleanUser) return false;
        if (u.address && u.address.toLowerCase() === cleanUser) return false;
        return u.username.trim().toLowerCase() !== cleanUser;
      });
      
      // Encrypt and store
      const encryptedUsers = encryptData(updatedUsers, get().secretKey || '');
      safeStorageSetItem(STORAGE_KEYS.LOGGED_IN_USERS, encryptedUsers);
      
      // If removing current user, clear current user
      const isCurrent =
        currentUser?.username?.trim().toLowerCase() === cleanUser ||
        (currentUser?.uid && currentUser.uid.toLowerCase() === cleanUser) ||
        (currentUser?.address && currentUser.address.toLowerCase() === cleanUser);

      if (isCurrent) {
        safeStorageRemoveItem(STORAGE_KEYS.CURRENT_USER);
        set({ currentUser: null, loggedInUsers: updatedUsers });
      } else {
        set({ loggedInUsers: updatedUsers });
      }
    },
    
    clearAllUsers: async () => {
      safeStorageRemoveItem(STORAGE_KEYS.LOGGED_IN_USERS);
      safeStorageRemoveItem(STORAGE_KEYS.CURRENT_USER);
      set({ currentUser: null, loggedInUsers: [] });
    },

    updateUserProfile: (usernameOrAddress, profile) => {
      const { currentUser, loggedInUsers, secretKey } = get();
      const target = usernameOrAddress.trim().toLowerCase();

      const updateMatch = (user: LoggedInUser): LoggedInUser => {
        const matches =
          user.username.trim().toLowerCase() === target ||
          (user.address && user.address.toLowerCase() === target) ||
          (user.uid && user.uid.toLowerCase() === target);

        if (!matches) return user;

        return {
          ...user,
          ...(profile.displayName !== undefined && { displayName: profile.displayName }),
          ...(profile.photoURL !== undefined && { photoURL: profile.photoURL }),
        };
      };

      const updatedUsers = loggedInUsers.map(updateMatch);
      const updatedCurrent = currentUser ? updateMatch(currentUser) : null;

      // Encrypt and save updated states
      const encryptedUsers = encryptData(updatedUsers, secretKey || '');
      safeStorageSetItem(STORAGE_KEYS.LOGGED_IN_USERS, encryptedUsers);

      if (updatedCurrent) {
        const encryptedUser = encryptData(updatedCurrent, secretKey || '');
        safeStorageSetItem(STORAGE_KEYS.CURRENT_USER, encryptedUser);
      }

      set({
        loggedInUsers: updatedUsers,
        currentUser: updatedCurrent,
      });
    },
    
    authenticateWithCallback: async (hiveResult, callback) => {
      set({ isLoading: true, error: null });

      try {
        // Call the dev's callback function
        const serverResponse = await callback(hiveResult);

        // Create the complete user object
        const user: LoggedInUser = {
          username: hiveResult.username,
          provider: hiveResult.provider,
          challenge: hiveResult.challenge,
          publicKey: hiveResult.publicKey,
          proof: hiveResult.proof,
          serverResponse,
          privatePostingKey: hiveResult.privatePostingKey,
          privateActiveKey: hiveResult.privateActiveKey,
          loginType: 'hive',
        };

        // Add to store
        get().addLoggedInUser(user);
        get().setCurrentUser(user);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
        set({ error: errorMessage });

        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    authenticateWeb2WithCallback: async (web2Result, callback) => {
      set({ isLoading: true, error: null });

      try {
        const serverResponse = await callback(web2Result);

        // Uniform identifier for Web2 user (uid primary)
        const username = web2Result.uid || web2Result.email || web2Result.displayName || `web2_${Date.now()}`;

        const user: LoggedInUser = {
          username,
          provider: web2Result.provider,
          challenge: '',
          publicKey: '',
          proof: '',
          serverResponse,
          loginType: 'web2',
          web2Provider: web2Result.provider,
          email: web2Result.email,
          displayName: web2Result.displayName,
          photoURL: web2Result.photoURL,
          uid: web2Result.uid,
        };

        get().addLoggedInUser(user);
        get().setCurrentUser(user);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Web2 authentication failed';
        set({ error: errorMessage });
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    authenticateWeb3WithCallback: async (web3Result, callback) => {
      set({ isLoading: true, error: null });

      try {
        const serverResponse = await callback(web3Result);
        const address = web3Result.address.toLowerCase();

        // Extract profile metadata from serverResponse if returned
        let serverDisplayName: string | undefined = undefined;
        let serverPhotoURL: string | undefined = undefined;
        let serverProvider: string | undefined = undefined;

        try {
          const parsed = typeof serverResponse === 'string' ? JSON.parse(serverResponse) : serverResponse;
          if (parsed && typeof parsed === 'object') {
            const userData = parsed.user || parsed;
            if (userData.displayName) serverDisplayName = userData.displayName;
            if (userData.profilePicture || userData.photoURL) serverPhotoURL = userData.profilePicture || userData.photoURL;
            if (userData.provider) serverProvider = userData.provider;
          }
        } catch {
          // ignore parsing error
        }

        const user: LoggedInUser = {
          username: address,
          provider: serverProvider || web3Result.walletName || web3Result.provider || 'reown',
          challenge: web3Result.message || '',
          publicKey: address,
          proof: web3Result.signature || web3Result.proof || '',
          serverResponse,
          loginType: 'web3',
          address,
          chainId: web3Result.chainId,
          signature: web3Result.signature,
          web3Provider: web3Result.provider || 'reown',
          web3WalletName: web3Result.walletName,
          web3WalletIcon: web3Result.walletIcon,
          displayName: serverDisplayName || web3Result.displayName || null,
          photoURL: serverPhotoURL || web3Result.photoURL || null,
        };

        get().addLoggedInUser(user);
        get().setCurrentUser(user);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Web3 authentication failed';
        set({ error: errorMessage });
        throw error;
      } finally {
        set({ isLoading: false });
      }
    }
  };
});

import { create } from 'zustand';
import CryptoJS from 'crypto-js';
import type { AuthStore, LoggedInUser } from '../types/auth';
import { STORAGE_KEYS } from '../constants/storage';

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
    localStorage.removeItem(STORAGE_KEYS.LEGACY_AUTH_STORAGE);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_HIVE_AUTH_ENCRYPTED);
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
    setHiveAuthPayload: (payload) => set({ hiveAuthPayload: payload }),
    setLoading: (loading) => set({ isLoading: loading }),
    setSecretKey: (secretKey) => { 
      set({ secretKey });
      const restored = initializeState(secretKey || '');
      set({ currentUser: restored.currentUser, loggedInUsers: restored.loggedInUsers });
    },
    setError: (error) => set({ error }),
    
    setCurrentUser: (user) => {
      // Encrypt and store
      if (user) {
        const encryptedUser = encryptData(user, get().secretKey || '');
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, encryptedUser);
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
      
      set({ currentUser: user });
    },
    
    addLoggedInUser: (user) => {
      const { loggedInUsers } = get();
      const updatedUsers = [...loggedInUsers.filter(u => u.username !== user.username), user];
      
      // Encrypt and store
      const encryptedUsers = encryptData(updatedUsers, get().secretKey || '');
      localStorage.setItem(STORAGE_KEYS.LOGGED_IN_USERS, encryptedUsers);
      
      set({ loggedInUsers: updatedUsers });
    },
    
    removeLoggedInUser: async (username) => {
      const { loggedInUsers, currentUser } = get();
      const updatedUsers = loggedInUsers.filter(u => u.username !== username);
      
      // Encrypt and store
      const encryptedUsers = encryptData(updatedUsers, get().secretKey || '');
      localStorage.setItem(STORAGE_KEYS.LOGGED_IN_USERS, encryptedUsers);
      
      // If removing current user, clear current user
      if (currentUser?.username === username) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        set({ currentUser: null, loggedInUsers: updatedUsers });
      } else {
        set({ loggedInUsers: updatedUsers });
      }
    },
    
    clearAllUsers: async () => {

      localStorage.removeItem(STORAGE_KEYS.LOGGED_IN_USERS);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      set({ currentUser: null, loggedInUsers: [] });
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
    }
  };
});

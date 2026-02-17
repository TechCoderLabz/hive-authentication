import type { Aioha } from "@aioha/aioha";

export interface HiveAuthResult {
  provider: string;
  challenge: string;  // This will be a hash from the Hive authentication
  publicKey: string;
  username: string;
  proof: string;      // This will be the timestamp
  privatePostingKey?: string;
  privateActiveKey?: string; // Optional active key (private key login only)
}

export interface ServerAuthResponse {
  token: string;
  type: string;
}

export interface LoggedInUser {
  username: string;
  provider: string;
  challenge: string;
  publicKey: string;
  proof: string;
  serverResponse: string; // JSON string from dev's app
  privatePostingKey?: string;
  privateActiveKey?: string; // Optional active key (private key login only)
}

export interface AuthStore {
  // Read-only state
  currentUser: LoggedInUser | null;
  loggedInUsers: LoggedInUser[];
  isLoading: boolean;
  error: string | null;
  hiveAuthPayload: string | null;
  
  // Actions (package internal use only)
  setCurrentUser: (user: LoggedInUser | null) => void;
  addLoggedInUser: (user: LoggedInUser) => void;
  removeLoggedInUser: (username: string) => Promise<void>;
  clearAllUsers: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHiveAuthPayload: (payload: string | null) => void;

  // Authentication
  authenticateWithCallback: (
    hiveResult: HiveAuthResult,
    callback: (hiveResult: HiveAuthResult) => Promise<string>
  ) => Promise<void>;
}

export interface SwitchUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate?: (hiveResult: HiveAuthResult) => Promise<string>;
  aioha: Aioha;
  shouldShowSwitchUser?: boolean;
  onSignMessage: (username: string) => string;
}

export interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  onAuthenticate?: (hiveResult: HiveAuthResult) => Promise<string>;
  aioha: Aioha;
  onSignMessage: (username: string) => string;
}

export interface AuthButtonProps {
  onAuthenticate: (hiveResult: HiveAuthResult) => Promise<string>;
  aioha: Aioha;
  shouldShowSwitchUser?: boolean;
  onClose?: () => void;
  onSignMessage: (username: string) => string;
}


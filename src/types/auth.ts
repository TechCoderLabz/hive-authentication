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
  // Web2 fields (populated when logged in via Google/Email)
  loginType?: 'hive' | 'web2';
  web2Provider?: 'google' | 'email';
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  uid?: string;
}

export interface AuthStore {
  // Read-only state
  currentUser: LoggedInUser | null;
  loggedInUsers: LoggedInUser[];
  isLoading: boolean;
  error: string | null;
  hiveAuthPayload: string | null;
  secretKey: string | null;
  aioha: Aioha | null;
  // Actions (package internal use only)
  setCurrentUser: (user: LoggedInUser | null) => void;
  addLoggedInUser: (user: LoggedInUser) => void;
  removeLoggedInUser: (username: string) => Promise<void>;
  clearAllUsers: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHiveAuthPayload: (payload: string | null) => void;
  setSecretKey: (secretKey: string | null) => void;
  setAioha: (aioha: Aioha | null) => void;
  // Authentication
  authenticateWithCallback: (
    hiveResult: HiveAuthResult,
    callback: (hiveResult: HiveAuthResult) => Promise<string>
  ) => Promise<void>;
  authenticateWeb2WithCallback: (
    web2Result: Web2AuthResult,
    callback: (web2Result: Web2AuthResult) => Promise<string>
  ) => Promise<void>;
  switchToActiveForCurrentUser: () => Promise<void>;
  switchToPostingForCurrentUser: () => Promise<void>;
}

export interface SwitchUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate?: (hiveResult: HiveAuthResult) => Promise<string>;
  aioha: Aioha;
  shouldShowSwitchUser?: boolean;
  isActiveFieldVisible?: boolean;
  onSignMessage: (username: string) => string;
  /** Optional colors for the Login/Add Account buttons. */
  loginButtonColors?: string[];
  /** Optional color for \"Login\" / \"Add Account\" text. */
  loginButtonTextColor?: string;
  /** Optional Firebase config for Web2 login. */
  web2Config?: Web2Config;
  /** Optional callback for Web2 authentication result. */
  onWeb2Authenticate?: (web2Result: Web2AuthResult) => Promise<string>;
  /** When true, shows HiveSigner as a login option. Default: false */
  hiveSignerVisible?: boolean;
}

export interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  onAuthenticate?: (hiveResult: HiveAuthResult) => Promise<string>;
  aioha: Aioha;
  onSignMessage: (username: string) => string;
  /** When true, shows optional Active Key field in private key login. Default: false */
  isActiveFieldVisible?: boolean;
  /** Optional colors for the Login button. */
  loginButtonColors?: string[];
  /** Optional color for the \"Login\" text. */
  loginButtonTextColor?: string;
  /** When true, shows HiveSigner as a login option. Default: false */
  hiveSignerVisible?: boolean;
}

export interface Web2Config {
  apiKey: string;
  authDomain: string;
  projectId: string;
  databaseURL?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

export interface Web2AuthResult {
  provider: 'google' | 'email';
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  idToken: string;
}

export interface AuthButtonProps {
  /** Encryption key for local storage (e.g. from your env/config). Replaces VITE_LOCAL_KEY. */
  encryptionKey: string;
  onAuthenticate: (hiveResult: HiveAuthResult) => Promise<string>;
  aioha: Aioha;
  shouldShowSwitchUser?: boolean;
  /** When true, shows optional Active Key field in private key login. Default: false */
  isActiveFieldVisible?: boolean;
  onClose?: () => void;
  onSignMessage: (username: string) => string;
  /**
   * Optional colors for the Login button.
   * - Pass a single color: ['#ff0000']
   * - Or multiple colors for a gradient: ['#ff0000', '#00ff00', '#0000ff']
   */
  loginButtonColors?: string[];
  /** Optional color for the "Login" text when the user is not logged in. */
  loginButtonTextColor?: string;
  /** Optional Firebase config for Web2 login (Google & Email). If not provided, Web2 login button is hidden. */
  web2Config?: Web2Config;
  /** Optional callback for Web2 authentication result. Required if web2Config is provided. */
  onWeb2Authenticate?: (web2Result: Web2AuthResult) => Promise<string>;
  /** When true, shows HiveSigner as a login option. Default: false */
  hiveSignerVisible?: boolean;
}


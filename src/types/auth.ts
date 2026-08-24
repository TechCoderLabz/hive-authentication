/* eslint-disable @typescript-eslint/no-explicit-any */
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
  // Login type indicator: 'hive' | 'web2' | 'web3'
  loginType?: 'hive' | 'web2' | 'web3';
  // Web2 fields (populated when logged in via Google/Apple/Email)
  web2Provider?: 'google' | 'apple' | 'email';
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  uid?: string;
  // Web3 / Reown fields (populated when logged in via Web3 wallet)
  address?: string;
  chainId?: number | string;
  signature?: string;
  web3Provider?: string;
  web3WalletName?: string;
  web3WalletIcon?: string;
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
  updateUserProfile: (
    usernameOrAddress: string,
    profile: { displayName?: string; photoURL?: string }
  ) => void;
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
  authenticateWeb3WithCallback: (
    web3Result: Web3AuthResult,
    callback: (web3Result: Web3AuthResult) => Promise<string>
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
  /** Optional color for "Login" / "Add Account" text. */
  loginButtonTextColor?: string;
  /** Optional Firebase config for Web2 login. */
  web2Config?: Web2Config;
  /** Optional callback for Web2 authentication result. */
  onWeb2Authenticate?: (web2Result: Web2AuthResult) => Promise<string>;
  /** Feature flag to enable or disable Web2 login UI. Default: false */
  enableWeb2Login?: boolean;
  /** Optional Reown AppKit config for Web3 wallet login. */
  reownConfig?: ReownConfig;
  /** Optional callback for Web3 authentication result. */
  onWeb3Authenticate?: (web3Result: Web3AuthResult) => Promise<string>;
  /** Feature flag to enable or disable Web3 login UI. Default: true when reownConfig is passed */
  enableWeb3Login?: boolean;
  /** Optional callback when user updates profile name/avatar */
  onUpdateProfile?: (profile: { username: string; displayName?: string; photoURL?: string }) => Promise<void>;
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
  /** Optional color for the "Login" text. */
  loginButtonTextColor?: string;
  /** Feature flag to enable or disable Web2 login UI. Default: false */
  enableWeb2Login?: boolean;
  /** Optional Firebase config for Web2 login. */
  web2Config?: Web2Config;
  /** Optional callback for Web2 authentication result. */
  onWeb2Authenticate?: (web2Result: Web2AuthResult) => Promise<string>;
  /** Optional Reown AppKit config for Web3 wallet login. */
  reownConfig?: ReownConfig;
  /** Optional callback for Web3 authentication result. */
  onWeb3Authenticate?: (web3Result: Web3AuthResult) => Promise<string>;
  /** Feature flag to enable or disable Web3 login UI. Default: true when reownConfig is passed */
  enableWeb3Login?: boolean;
  /** Optional callback when user updates profile name/avatar */
  onUpdateProfile?: (profile: { username: string; displayName?: string; photoURL?: string }) => Promise<void>;
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
  provider: 'google' | 'apple' | 'email';
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  idToken: string;
}

export interface ReownConfig {
  projectId: string;
  metadata?: {
    name: string;
    description?: string;
    url?: string;
    icons?: string[];
  };
  appName?: string;
  appDescription?: string;
  appUrl?: string;
  appIcons?: string[];
  networks?: any[];
  themeMode?: 'dark' | 'light';
}

export interface Web3AuthResult {
  provider: string; // 'reown' | 'walletconnect' | 'metamask' | 'injected'
  address: string;
  chainId?: number | string;
  signature?: string;
  message?: string;
  proof?: string;
  walletName?: string;
  walletIcon?: string;
  displayName?: string | null;
  photoURL?: string | null;
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
  /** Feature flag to enable or disable Web2 login UI. Default: false */
  enableWeb2Login?: boolean;
  /** Optional Reown AppKit config for Web3 wallet login. */
  reownConfig?: ReownConfig;
  /** Optional callback for Web3 authentication result. Required if reownConfig is provided. */
  onWeb3Authenticate?: (web3Result: Web3AuthResult) => Promise<string>;
  /** Feature flag to enable or disable Web3 login UI. Default: false */
  enableWeb3Login?: boolean;
  /** Optional callback when user updates profile name/avatar */
  onUpdateProfile?: (profile: { username: string; displayName?: string; photoURL?: string }) => Promise<void>;
  /** When true, shows HiveSigner as a login option. Default: false */
  hiveSignerVisible?: boolean;
}

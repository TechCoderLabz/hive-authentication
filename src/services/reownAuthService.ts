/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAppKit, type AppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, arbitrum, polygon, base, optimism, bsc } from '@reown/appkit/networks';
import { BrowserProvider } from 'ethers';
import type { ReownConfig, Web3AuthResult } from '../types/auth';

const DEFAULT_NETWORKS = [mainnet, arbitrum, polygon, base, optimism, bsc] as const;

export interface InjectedWalletInfo {
  id: 'metamask' | 'coinbase' | 'trust' | 'phantom' | 'rainbow' | 'injected';
  name: string;
  isInstalled: boolean;
  provider?: any;
}

export class ReownAuthService {
  private static appKitInstance: AppKit | null = null;
  private static currentProjectId: string | null = null;

  /**
   * Initializes or returns the singleton Reown AppKit instance.
   */
  public static getAppKit(config: ReownConfig): AppKit {
    if (this.appKitInstance && this.currentProjectId === config.projectId) {
      return this.appKitInstance;
    }

    const metadata = {
      name: config.metadata?.name || config.appName || 'Hive Authentication',
      description: config.metadata?.description || config.appDescription || 'Web3 Login powered by Reown',
      url: config.metadata?.url || config.appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://hivesuite.app'),
      icons: config.metadata?.icons || config.appIcons || ['https://avatars.githubusercontent.com/u/179229932'],
    };

    const networks = config.networks && config.networks.length > 0
      ? (config.networks as any)
      : (DEFAULT_NETWORKS as any);

    const ethersAdapter = new EthersAdapter();

    this.appKitInstance = createAppKit({
      adapters: [ethersAdapter],
      networks,
      metadata,
      projectId: config.projectId,
      themeMode: config.themeMode || 'dark',
      features: {
        analytics: true,
        email: true,
        socials: ['google', 'x', 'github', 'discord', 'apple'],
        emailShowWallets: true,
      },
    });

    this.currentProjectId = config.projectId;
    return this.appKitInstance;
  }

  /**
   * Inspects window.ethereum and returns detected browser extension wallet providers.
   */
  public static detectInjectedWallets(): InjectedWalletInfo[] {
    if (typeof window === 'undefined') return [];

    const eth = (window as any).ethereum;
    const phantomEth = (window as any).phantom?.ethereum;
    const trustEth = (window as any).trustwallet || ((window as any).ethereum?.isTrust ? (window as any).ethereum : null);
    const cbEth = (window as any).coinbaseWalletExtension || ((window as any).ethereum?.isCoinbaseWallet ? (window as any).ethereum : null);

    const providers: any[] = Array.isArray(eth?.providers) ? eth.providers : [eth].filter(Boolean);

    const isMetaMask = providers.some((p) => p?.isMetaMask && !p?.isPhantom && !p?.isTrust && !p?.isCoinbaseWallet);
    const isCoinbase = Boolean(cbEth || providers.some((p) => p?.isCoinbaseWallet));
    const isTrust = Boolean(trustEth || providers.some((p) => p?.isTrust || p?.isTrustWallet));
    const isPhantom = Boolean(phantomEth || providers.some((p) => p?.isPhantom));
    const isRainbow = providers.some((p) => p?.isRainbow);

    const metaMaskProvider = providers.find((p) => p?.isMetaMask && !p?.isPhantom && !p?.isTrust && !p?.isCoinbaseWallet) || (isMetaMask ? eth : null);
    const coinbaseProvider = cbEth || providers.find((p) => p?.isCoinbaseWallet) || (isCoinbase ? eth : null);
    const trustProvider = trustEth || providers.find((p) => p?.isTrust || p?.isTrustWallet) || (isTrust ? eth : null);
    const phantomProvider = phantomEth || providers.find((p) => p?.isPhantom);
    const rainbowProvider = providers.find((p) => p?.isRainbow);

    return [
      { id: 'metamask', name: 'MetaMask', isInstalled: isMetaMask, provider: metaMaskProvider },
      { id: 'trust', name: 'Trust Wallet', isInstalled: isTrust, provider: trustProvider },
      { id: 'coinbase', name: 'Coinbase Wallet', isInstalled: isCoinbase, provider: coinbaseProvider },
      { id: 'phantom', name: 'Phantom', isInstalled: isPhantom, provider: phantomProvider },
      { id: 'rainbow', name: 'Rainbow', isInstalled: isRainbow, provider: rainbowProvider },
    ];
  }

  /**
   * Helper to detect the active wallet client brand and icon.
   */
  public static detectWalletInfo(appKit: AppKit, walletProvider: any): { walletName: string; walletIcon?: string } {
    // 1. Check AppKit internal walletInfo if available
    const appKitWalletInfo = (appKit as any).getWalletInfo?.();
    if (appKitWalletInfo?.name) {
      return {
        walletName: appKitWalletInfo.name,
        walletIcon: appKitWalletInfo.icon,
      };
    }

    // 2. Check WalletConnect session peer metadata
    const wcPeerMeta =
      walletProvider?.session?.peer?.metadata ||
      walletProvider?.client?.session?.peer?.metadata ||
      (walletProvider as any)?.signer?.session?.peer?.metadata;
    if (wcPeerMeta?.name) {
      return {
        walletName: wcPeerMeta.name,
        walletIcon: Array.isArray(wcPeerMeta.icons) && wcPeerMeta.icons.length > 0 ? wcPeerMeta.icons[0] : undefined,
      };
    }

    // 3. Check injected provider flags
    const prov = walletProvider?.provider || walletProvider;
    const isMetaMask = Boolean(prov?.isMetaMask || (typeof window !== 'undefined' && (window as any).ethereum?.isMetaMask));
    const isCoinbase = Boolean(prov?.isCoinbaseWallet || (typeof window !== 'undefined' && (window as any).ethereum?.isCoinbaseWallet));
    const isTrust = Boolean(prov?.isTrust || prov?.isTrustWallet || (typeof window !== 'undefined' && (window as any).ethereum?.isTrust));
    const isPhantom = Boolean(prov?.isPhantom || (typeof window !== 'undefined' && (window as any).phantom?.ethereum?.isPhantom));
    const isRainbow = Boolean(prov?.isRainbow || (typeof window !== 'undefined' && (window as any).ethereum?.isRainbow));

    if (isTrust) return { walletName: 'Trust Wallet' };
    if (isCoinbase) return { walletName: 'Coinbase Wallet' };
    if (isPhantom) return { walletName: 'Phantom' };
    if (isRainbow) return { walletName: 'Rainbow' };
    if (isMetaMask) return { walletName: 'MetaMask' };

    return { walletName: 'Web3 Wallet' };
  }

  /**
   * Connects directly to an injected browser extension provider (MetaMask, Trust, Coinbase, etc.)
   * and optionally requests permission to select a specific account.
   */
  public static async loginWithInjected(
    injectedProvider: any,
    walletName: string,
    onSignMessage?: (address: string) => string,
    forceAccountSelection = false
  ): Promise<Web3AuthResult> {
    if (!injectedProvider) {
      throw new Error(`${walletName} extension not detected in browser.`);
    }

    let accounts: string[] = [];

    // Prompt user account selection if requested / supported
    if (forceAccountSelection && typeof injectedProvider.request === 'function') {
      try {
        const permissions = await injectedProvider.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
        const accountsPermission = permissions?.find((p: any) => p.parentCapability === 'eth_accounts');
        if (accountsPermission?.caveats?.[0]?.value) {
          accounts = accountsPermission.caveats[0].value;
        }
      } catch (err: any) {
        console.warn('wallet_requestPermissions cancelled or unsupported, falling back to eth_requestAccounts', err);
      }
    }

    if (!accounts || accounts.length === 0) {
      accounts = await injectedProvider.request({ method: 'eth_requestAccounts' });
    }

    if (!accounts || accounts.length === 0) {
      throw new Error(`No account selected in ${walletName}.`);
    }

    const address = accounts[0].toLowerCase();
    let chainId = 1;
    try {
      const hexChain = await injectedProvider.request({ method: 'eth_chainId' });
      chainId = parseInt(hexChain, 16) || 1;
    } catch {
      // default 1
    }

    const message = onSignMessage
      ? onSignMessage(address)
      : `Sign in to ${typeof window !== 'undefined' ? window.location.host : 'App'} with wallet ${address}\n\nTimestamp: ${new Date().toISOString()}`;

    let signature: string;
    try {
      const browserProvider = new BrowserProvider(injectedProvider);
      const signer = await browserProvider.getSigner(address);
      signature = await signer.signMessage(message);
    } catch (err: any) {
      try {
        const hexMessage = '0x' + Buffer.from(message, 'utf8').toString('hex');
        signature = await injectedProvider.request({
          method: 'personal_sign',
          params: [hexMessage, address],
        });
      } catch (fallbackErr: any) {
        throw new Error(fallbackErr?.message || err?.message || 'Signature request rejected');
      }
    }

    return {
      provider: 'injected',
      address,
      chainId,
      signature,
      message,
      proof: signature,
      walletName,
    };
  }

  /**
   * Connects a Web3 wallet via Reown AppKit and signs an authentication challenge.
   */
  public static async loginWithReown(
    config: ReownConfig,
    onSignMessage?: (address: string) => string,
    options?: { forceAccountSelection?: boolean }
  ): Promise<Web3AuthResult> {
    const appKit = this.getAppKit(config);

    if (options?.forceAccountSelection) {
      try {
        await appKit.disconnect();
      } catch {
        // ignore
      }
    }

    let currentAccount = appKit.getAccount();
    let walletProvider = appKit.getWalletProvider();

    if (options?.forceAccountSelection || !currentAccount?.isConnected || !currentAccount?.address || !walletProvider) {
      // Open Reown modal to connect / select account
      await appKit.open();

      // Wait for wallet connection with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error('Wallet connection timed out'));
        }, 120000); // 2 minute timeout

        const unsubscribe = appKit.subscribeState((state) => {
          const account = appKit.getAccount();
          const provider = appKit.getWalletProvider();

          if (account?.isConnected && account?.address && provider) {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          } else if (!state.open && !account?.isConnected) {
            // Modal closed without connecting
            clearTimeout(timeout);
            unsubscribe();
            reject(new Error('Wallet connection was cancelled'));
          }
        });
      });

      currentAccount = appKit.getAccount();
      walletProvider = appKit.getWalletProvider();
    }

    if (!currentAccount?.address || !walletProvider) {
      throw new Error('No wallet connected');
    }

    const address = currentAccount.address.toLowerCase();
    const chainId = appKit.getChainId?.() || 1;
    const { walletName, walletIcon } = this.detectWalletInfo(appKit, walletProvider);

    // Generate challenge message
    const message = onSignMessage
      ? onSignMessage(address)
      : `Sign in to ${typeof window !== 'undefined' ? window.location.host : 'App'} with wallet ${address}\n\nTimestamp: ${new Date().toISOString()}`;

    // Request message signature from the connected wallet
    let signature: string;
    try {
      const browserProvider = new BrowserProvider(walletProvider as any);
      const signer = await browserProvider.getSigner();
      signature = await signer.signMessage(message);
    } catch (err: any) {
      // Fallback to raw personal_sign RPC request
      try {
        if (typeof (walletProvider as any).request === 'function') {
          const hexMessage = '0x' + Buffer.from(message, 'utf8').toString('hex');
          signature = await (walletProvider as any).request({
            method: 'personal_sign',
            params: [hexMessage, address],
          });
        } else {
          throw err;
        }
      } catch (fallbackErr: any) {
        throw new Error(fallbackErr?.message || err?.message || 'Signature request rejected');
      }
    }

    return {
      provider: 'reown',
      address,
      chainId,
      signature,
      message,
      proof: signature,
      walletName,
      walletIcon,
    };
  }

  /**
   * Disconnects the connected Web3 wallet.
   */
  public static async disconnect(): Promise<void> {
    if (this.appKitInstance) {
      try {
        await this.appKitInstance.disconnect();
      } catch (err) {
        console.warn('Reown disconnect error:', err);
      }
    }
  }

  /**
   * Gets the active account state.
   */
  public static getAccount(): { isConnected: boolean; address?: string } {
    const acc = this.appKitInstance?.getAccount?.();
    return {
      isConnected: Boolean(acc?.isConnected),
      address: acc?.address,
    };
  }
}

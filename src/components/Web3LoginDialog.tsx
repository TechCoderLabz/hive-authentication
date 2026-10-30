/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ReownAuthService, type InjectedWalletInfo } from '../services/reownAuthService';
import { useAuthStore } from '../store/authStore';
import type { ReownConfig, Web3AuthResult } from '../types/auth';
import MetaMaskIcon from '../assets/metamask.svg';
import CoinbaseIcon from '../assets/coinbase.svg';
import TrustWalletIcon from '../assets/trustwallet.svg';
import PhantomIcon from '../assets/phantom.svg';
import RainbowIcon from '../assets/rainbow.svg';
import WalletConnectIcon from '../assets/walletconnect.svg';
import ReownIcon from '../assets/reown.svg';
import EthereumIcon from '../assets/ethereum.svg';

interface Web3LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  embedded?: boolean;
  reownConfig?: ReownConfig;
  onWeb3Authenticate?: (web3Result: Web3AuthResult) => Promise<string>;
  onSignMessage?: (address: string) => string;
  onUpdateProfile?: (profile: { username: string; displayName?: string; photoURL?: string }) => Promise<void>;
  theme?: 'light' | 'dark';
  loginButtonColors?: string[];
  loginButtonTextColor?: string;
}

export const Web3LoginDialog: React.FC<Web3LoginDialogProps> = ({
  isOpen,
  onClose,
  onBack,
  embedded = false,
  reownConfig,
  onWeb3Authenticate,
  onSignMessage,
  onUpdateProfile,
  theme: _theme = 'dark',
  loginButtonColors: _loginButtonColors,
  loginButtonTextColor,
}) => {
  const [step, setStep] = useState<'select-wallet' | 'profile-setup'>('select-wallet');
  const [error, setError] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [forceAccountSelect, setForceAccountSelect] = useState(false);
  const [injectedWallets, setInjectedWallets] = useState<InjectedWalletInfo[]>([]);

  // Profile Setup State for first-time / unconfigured users
  const [setupUser, setSetupUser] = useState<{
    username: string;
    address: string;
    walletName?: string;
    walletIcon?: string;
  } | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [activeAvatarTab, setActiveAvatarTab] = useState<'presets' | 'url' | 'upload'>('presets');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { authenticateWeb3WithCallback, updateUserProfile } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      setInjectedWallets(ReownAuthService.detectInjectedWallets());
    }
  }, [isOpen]);

  const config: ReownConfig = reownConfig || {
    projectId: 'b56e18d47c72ab683b10814fe9495694',
    metadata: {
      name: 'Hive Authentication',
      description: 'Web3 Login powered by Reown',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://hivesuite.app',
      icons: ['https://avatars.githubusercontent.com/u/179229932'],
    },
  };

  const handleConnectWallet = async (walletId: string, walletName: string) => {
    setError(null);
    setConnectingWallet(walletId);

    try {
      let result: Web3AuthResult;

      // 1. Check if injected extension is available for direct connection
      const matchingInjected = injectedWallets.find((w) => w.id === walletId && w.isInstalled && w.provider);

      if (matchingInjected && matchingInjected.provider) {
        // Direct connect via browser extension with optional account selector
        result = await ReownAuthService.loginWithInjected(
          matchingInjected.provider,
          walletName,
          onSignMessage,
          forceAccountSelect
        );
      } else {
        // Connect via Reown AppKit
        result = await ReownAuthService.loginWithReown(config, onSignMessage, {
          forceAccountSelection: forceAccountSelect,
        });
      }

      let serverResponseData: any = null;

      if (onWeb3Authenticate) {
        const rawRes = await onWeb3Authenticate(result);
        try {
          serverResponseData = typeof rawRes === 'string' ? JSON.parse(rawRes) : rawRes;
        } catch {
          // ignore
        }
        await authenticateWeb3WithCallback(result, async () => rawRes);
      } else {
        await authenticateWeb3WithCallback(result, async () => {
          return JSON.stringify({
            message: 'Web3 login successful',
            address: result.address,
            provider: result.provider,
          });
        });
      }

      const existingDisplayName =
        serverResponseData?.user?.displayName ||
        serverResponseData?.displayName ||
        result.displayName;

      const existingPhotoURL =
        serverResponseData?.user?.profilePicture ||
        serverResponseData?.photoURL ||
        result.photoURL;

      // If user does not have a display name yet (e.g. first-time login), prompt profile setup
      if (!existingDisplayName) {
        setSetupUser({
          username: result.address.toLowerCase(),
          address: result.address,
          walletName: result.walletName,
          walletIcon: result.walletIcon,
        });
        setDisplayName('');
        setPhotoURL(existingPhotoURL || `https://effigy.im/a/${result.address}.svg`);
        setStep('profile-setup');
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error(`Web3 Login Error (${walletName}):`, err);
      const msg = err?.message || `${walletName} login failed. Please try again.`;
      setError(msg);
    } finally {
      setConnectingWallet(null);
    }
  };

  const handleSaveProfileSetup = async () => {
    if (!setupUser) return;
    setIsSavingProfile(true);

    try {
      const cleanName = displayName.trim();
      const cleanPhoto = photoURL.trim();

      // 1. Update local store
      updateUserProfile(setupUser.username, {
        displayName: cleanName || undefined,
        photoURL: cleanPhoto || undefined,
      });

      // 2. Call backend sync callback
      if (onUpdateProfile) {
        await onUpdateProfile({
          username: setupUser.username,
          displayName: cleanName || undefined,
          photoURL: cleanPhoto || undefined,
        });
      }

      onClose();
    } catch (err) {
      console.error('Failed to save profile during setup:', err);
      onClose();
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSkipProfileSetup = () => {
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image file size must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoURL(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const getWalletBadgeIcon = (name?: string) => {
    const n = (name || '').toLowerCase();
    if (n.includes('metamask')) return MetaMaskIcon;
    if (n.includes('coinbase')) return CoinbaseIcon;
    if (n.includes('trust')) return TrustWalletIcon;
    if (n.includes('phantom')) return PhantomIcon;
    if (n.includes('rainbow')) return RainbowIcon;
    if (n.includes('walletconnect')) return WalletConnectIcon;
    return EthereumIcon;
  };

  if (!isOpen) return null;

  const addr = setupUser?.address || '';

  const presetAvatars = [
    { label: 'Effigy Identicon', url: `https://effigy.im/a/${addr}.svg` },
    { label: 'Pixel Avatar', url: `https://api.dicebear.com/7.x/identicon/svg?seed=${addr}&backgroundColor=0052ff,627eea,e31337` },
    { label: 'Bot Avatar', url: `https://api.dicebear.com/7.x/bottts/svg?seed=${addr}` },
    { label: 'Avataaars', url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${addr}` },
    { label: 'Shapes', url: `https://api.dicebear.com/7.x/shapes/svg?seed=${addr}` },
    { label: 'Robohash', url: `https://robohash.org/${addr}.png?set=set1&size=120x120` },
  ];

  const walletOptions = [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: MetaMaskIcon,
      subtitle: injectedWallets.find((w) => w.id === 'metamask')?.isInstalled ? 'Installed Extension' : 'Mobile app or Extension',
      isInstalled: Boolean(injectedWallets.find((w) => w.id === 'metamask')?.isInstalled),
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      icon: TrustWalletIcon,
      subtitle: injectedWallets.find((w) => w.id === 'trust')?.isInstalled ? 'Installed Extension' : 'Mobile app or Extension',
      isInstalled: Boolean(injectedWallets.find((w) => w.id === 'trust')?.isInstalled),
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      icon: CoinbaseIcon,
      subtitle: injectedWallets.find((w) => w.id === 'coinbase')?.isInstalled ? 'Installed Extension' : 'Coinbase Wallet app',
      isInstalled: Boolean(injectedWallets.find((w) => w.id === 'coinbase')?.isInstalled),
    },
    {
      id: 'phantom',
      name: 'Phantom',
      icon: PhantomIcon,
      subtitle: injectedWallets.find((w) => w.id === 'phantom')?.isInstalled ? 'Installed Extension' : 'Multi-chain wallet',
      isInstalled: Boolean(injectedWallets.find((w) => w.id === 'phantom')?.isInstalled),
    },
    {
      id: 'rainbow',
      name: 'Rainbow',
      icon: RainbowIcon,
      subtitle: 'Rainbow mobile or extension',
      isInstalled: Boolean(injectedWallets.find((w) => w.id === 'rainbow')?.isInstalled),
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      icon: WalletConnectIcon,
      subtitle: 'Scan QR code with any mobile wallet',
      isInstalled: false,
    },
    {
      id: 'all',
      name: 'All Wallets (500+)',
      icon: ReownIcon,
      subtitle: 'Reown AppKit Multi-Wallet Directory',
      isInstalled: false,
    },
  ];

  const content = step === 'profile-setup' ? (
    <>
      {/* Profile Setup Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <h3 className="font-bold text-lg text-white">✨ Set Up Your Profile</h3>
        </div>
        <button
          className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-zinc-800 cursor-pointer"
          onClick={handleSkipProfileSetup}
        >
          ✕
        </button>
      </div>

      <p className="text-xs text-zinc-400 mt-2">
        Set your custom Profile Name & Avatar so other users see your name instead of your hex wallet address!
      </p>

      {/* Live Preview Card */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 flex items-center gap-3.5 mt-3 shadow-inner">
        <div className="relative shrink-0">
          <img
            src={photoURL || `https://effigy.im/a/${addr}.svg`}
            alt="Avatar Preview"
            className="w-13 h-13 rounded-full border-2 border-red-500/70 object-cover bg-zinc-900"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://effigy.im/a/${addr}.svg`;
            }}
          />
          <img
            src={getWalletBadgeIcon(setupUser?.walletName)}
            alt="Wallet Icon"
            className="w-5 h-5 absolute -bottom-0.5 -right-0.5 bg-zinc-950 rounded-full p-0.5 border border-zinc-700 shadow-md"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-base text-zinc-100 truncate">
              {displayName.trim() || (addr.startsWith('0x') ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr)}
            </p>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-950/80 border border-red-800/60 text-red-300 rounded-full shrink-0">
              {setupUser?.walletName || 'Web3 Wallet'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono truncate mt-0.5">
            {addr}
          </p>
        </div>
      </div>

      {/* Profile Name Input */}
      <div className="space-y-1.5 mt-3">
        <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Profile Name <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={30}
            autoFocus
            placeholder="e.g. CryptoNinja, Lokesh"
            className="w-full bg-zinc-900/90 border border-zinc-700/80 hover:border-zinc-600 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 transition-colors"
          />
          <span className="absolute right-3 top-2.5 text-[10px] text-zinc-500">
            {displayName.length}/30
          </span>
        </div>
      </div>

      {/* Avatar Selection Tabs */}
      <div className="space-y-2 mt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Choose Avatar
          </label>
          <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
            <button
              type="button"
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                activeAvatarTab === 'presets'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              onClick={() => setActiveAvatarTab('presets')}
            >
              Presets
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                activeAvatarTab === 'url'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              onClick={() => setActiveAvatarTab('url')}
            >
              URL
            </button>
            <button
              type="button"
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                activeAvatarTab === 'upload'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              onClick={() => setActiveAvatarTab('upload')}
            >
              Upload
            </button>
          </div>
        </div>

        {activeAvatarTab === 'presets' && (
          <div className="grid grid-cols-6 gap-2 p-2.5 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
            {presetAvatars.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                title={preset.label}
                className={`relative p-1 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden group ${
                  photoURL === preset.url
                    ? 'border-red-500 bg-red-500/20 shadow-[0_0_10px_rgba(227,19,55,0.3)] scale-105'
                    : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-600 hover:bg-zinc-800'
                }`}
                onClick={() => setPhotoURL(preset.url)}
              >
                <img
                  src={preset.url}
                  alt={preset.label}
                  className="w-full aspect-square rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://effigy.im/a/${addr}.svg`;
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {activeAvatarTab === 'url' && (
          <div className="space-y-2 p-2.5 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
            <div className="flex gap-2">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="flex-1 bg-zinc-900 border border-zinc-700/80 focus:border-red-500 focus:outline-none rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500"
              />
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-colors cursor-pointer"
                onClick={() => {
                  if (customUrlInput.trim()) {
                    setPhotoURL(customUrlInput.trim());
                  }
                }}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {activeAvatarTab === 'upload' && (
          <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80 text-center space-y-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="w-full py-2 px-3 rounded-xl border border-dashed border-zinc-700 hover:border-red-500 bg-zinc-900 hover:bg-zinc-800/80 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <span>📁</span> Choose Image File (Max 2MB)
            </button>
            {photoURL && photoURL.startsWith('data:image') && (
              <p className="text-[10px] text-emerald-400">✓ Image loaded from local file</p>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-3 flex items-center gap-2.5">
        <button
          type="button"
          className="flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          onClick={handleSkipProfileSetup}
        >
          Skip for now
        </button>
        <button
          type="button"
          disabled={isSavingProfile}
          className="flex-2 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-md cursor-pointer disabled:opacity-50"
          onClick={handleSaveProfileSetup}
        >
          {isSavingProfile ? 'Saving...' : 'Save Profile & Continue →'}
        </button>
      </div>
    </>
  ) : (
    <>
      <div className="flex items-center justify-between mb-3">
        {onBack && (
          <button
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            onClick={() => {
              setError(null);
              onBack();
            }}
          >
            ←
          </button>
        )}

        <h3
          className="font-bold text-lg flex-1 text-center text-zinc-100"
          style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}
        >
          Select Web3 Wallet
        </h3>

        {!embedded && (
          <button
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>

      <p className="text-xs text-zinc-400 text-center mb-3">
        Choose your preferred Web3 wallet or connect with any mobile app.
      </p>

      {/* Account Selection Toggle */}
      <div className="mb-3 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔄</span>
          <div>
            <p className="text-xs font-semibold text-zinc-200">Switch / Choose Account</p>
            <p className="text-[10px] text-zinc-400">Prompt account selector popup in wallet</p>
          </div>
        </div>
        <input
          type="checkbox"
          checked={forceAccountSelect}
          onChange={(e) => setForceAccountSelect(e.target.checked)}
          className="toggle toggle-sm toggle-error cursor-pointer"
        />
      </div>

      {/* Wallet Options List */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {walletOptions.map((wallet) => (
          <button
            key={wallet.id}
            type="button"
            disabled={Boolean(connectingWallet)}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
              connectingWallet === wallet.id
                ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(227,19,55,0.2)]'
                : 'border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800 hover:border-zinc-700'
            } disabled:opacity-60`}
            onClick={() => handleConnectWallet(wallet.id, wallet.name)}
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-950 p-2 flex items-center justify-center border border-zinc-800 shrink-0">
              <img src={wallet.icon} alt={wallet.name} className="w-6 h-6 object-contain" />
            </div>

            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-zinc-100 truncate">{wallet.name}</span>
                {wallet.isInstalled && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                    Detected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 truncate">{wallet.subtitle}</p>
            </div>

            {connectingWallet === wallet.id ? (
              <span className="loading loading-spinner loading-xs text-red-500"></span>
            ) : (
              <span className="text-zinc-500 text-xs">→</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center justify-between gap-2">
          <span className="break-all">{error}</span>
          <button className="text-red-400 hover:text-white shrink-0" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-md bg-zinc-950/95 text-white rounded-3xl border border-zinc-800 shadow-[0_0_50px_rgba(227,19,55,0.15)] overflow-hidden p-6">
        {content}
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>,
    document.body
  );
};

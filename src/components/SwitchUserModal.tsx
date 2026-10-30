import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import CryptoJS from 'crypto-js';
import { LoginDialog } from './LoginDialog';
import { ProfileEditModal } from './ProfileEditModal';
import { useAuthStore } from '../store/authStore';
import type { LoggedInUser, SwitchUserModalProps, ReownConfig, Web3AuthResult } from '../types/auth';
import { AuthService } from '../services/authService';
import KeychainIcon from '../assets/keychain.svg';
import HiveAuthIcon from '../assets/hiveauth-light.svg';
import HiveSignerIcon from '../assets/hivesigner.svg';
import PrivateKeyIcon from '../assets/privatekey.svg';
import Web2Icon from '../assets/web2.svg';
import PeakLockIcon from '../assets/peaklock.svg';
import GoogleIcon from '../assets/google.svg';
import AppleIcon from '../assets/apple.svg';
import EthereumIcon from '../assets/ethereum.svg';
import MetaMaskIcon from '../assets/metamask.svg';
import CoinbaseIcon from '../assets/coinbase.svg';
import TrustWalletIcon from '../assets/trustwallet.svg';
import PhantomIcon from '../assets/phantom.svg';
import RainbowIcon from '../assets/rainbow.svg';
import WalletConnectIcon from '../assets/walletconnect.svg';

export const SwitchUserModal: React.FC<
  SwitchUserModalProps & {
    theme?: "light" | "dark";
    reownConfig?: ReownConfig;
    onWeb3Authenticate?: (web3Result: Web3AuthResult) => Promise<string>;
    enableWeb3Login?: boolean;
    onUpdateProfile?: (profile: { username: string; displayName?: string; photoURL?: string }) => Promise<void>;
  }
> = ({
  isOpen,
  onClose,
  onAuthenticate,
  aioha,
  shouldShowSwitchUser = true,
  isActiveFieldVisible = false,
  onSignMessage,
  theme = "light",
  loginButtonColors,
  loginButtonTextColor,
  web2Config,
  onWeb2Authenticate,
  enableWeb2Login = false,
  reownConfig,
  onWeb3Authenticate,
  enableWeb3Login = true,
  onUpdateProfile,
  hiveSignerVisible = false,
}) => {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingUser, setEditingUser] = useState<LoggedInUser | null>(null);
  const { currentUser, loggedInUsers, setCurrentUser, removeLoggedInUser, clearAllUsers } = useAuthStore();

  const handleSwitchUser = async (user: LoggedInUser) => {
    setCurrentUser(user);
    // Web2 or Web3 users don't need aioha switching
    if (user.loginType === 'web2' || user.loginType === 'web3') {
      onClose();
      return;
    }
    if (user.privatePostingKey) {
      try {
        const cleanUser = user.username.trim().toLowerCase();
        const currentLoggedInUser = aioha?.getCurrentUser?.();
        const otherLogins = aioha?.getOtherLogins?.() || {};
        if (currentLoggedInUser?.toLowerCase() === cleanUser) {
          await aioha.logout();
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else if (otherLogins && otherLogins[cleanUser]) {
          await AuthService.removeUser(aioha, cleanUser);
        }
        await AuthService.switchUserWithPrivatePostingKey(
          aioha,
          cleanUser,
          user.privatePostingKey,
          onSignMessage(cleanUser)
        );
      } catch (err) {
        console.warn('Error switching with private posting key:', err);
      }
      onClose();
      return;
    }

    // Standard Hive provider switch (Keychain, HiveAuth, HiveSigner, PeakLock)
    AuthService.switchUser(aioha, user.username, user.provider);
    onClose();
  };

  const handleLogoutUser = async (user: LoggedInUser) => {
    await removeLoggedInUser(user.username);
    if (user.loginType !== 'web2' && user.loginType !== 'web3') {
      await AuthService.removeUser(aioha, user.username);
    }
  };

  const handleLogoutAll = async () => {
    try {
      if (aioha) {
        await aioha.logout();
        const otherLogins = aioha.getOtherLogins ? aioha.getOtherLogins() : {};
        if (otherLogins) {
          for (const user of Object.keys(otherLogins)) {
            await AuthService.removeUser(aioha, user);
          }
        }
      }
      // Clear app state / storage
      await clearAllUsers();
      // Close modal
      onClose();
    } catch (error) {
      console.error("Error logging out all users:", error);
    }
  };

  const handleAddAccount = () => {
    setShowAddAccount(true);
  };

  const handleBackFromLogin = () => {
    setShowAddAccount(false);
  };

  const getProviderIcon = (user: LoggedInUser) => {
    if (user.loginType === 'web2') {
      switch (user.web2Provider) {
        case 'google':
          return GoogleIcon;
        case 'apple':
          return AppleIcon;
        default:
          return Web2Icon;
      }
    }
    if (user.loginType === 'web3') {
      const name = (user.web3WalletName || user.provider || '').toLowerCase();
      if (name.includes('metamask')) return MetaMaskIcon;
      if (name.includes('coinbase')) return CoinbaseIcon;
      if (name.includes('trust')) return TrustWalletIcon;
      if (name.includes('phantom')) return PhantomIcon;
      if (name.includes('rainbow')) return RainbowIcon;
      if (name.includes('walletconnect')) return WalletConnectIcon;
      return user.web3WalletIcon || EthereumIcon;
    }
    switch (user.provider) {
      case 'keychain':
        return KeychainIcon;
      case 'hiveauth':
        return HiveAuthIcon;
      case 'hivesigner':
        return HiveSignerIcon;
      case 'privatePostingKey':
        return PrivateKeyIcon;
      case 'peaklock':
        return PeakLockIcon;
      default:
        return KeychainIcon;
    }
  };

  const getProviderName = (user: LoggedInUser) => {
    if (user.loginType === 'web2') {
      if (user.web2Provider === 'google') return 'Google';
      if (user.web2Provider === 'apple') return 'Apple';
      return 'Email';
    }
    if (user.loginType === 'web3') {
      return user.web3WalletName || 'Web3 Wallet';
    }
    switch (user.provider) {
      case 'keychain':
        return 'Keychain';
      case 'hiveauth':
        return 'HiveAuth';
      case 'hivesigner':
        return 'HiveSigner';
      case 'privatePostingKey':
        return 'PrivateKey';
      case 'peaklock':
        return 'PeakLock';
      default:
        return user.provider || 'Hive';
    }
  };

  const getUserAvatar = (user: LoggedInUser) => {
    if (user.photoURL) {
      return user.photoURL;
    }
    if (user.loginType === 'web2') {
      if (user.email) {
        try {
          const hash = CryptoJS.MD5(user.email.trim().toLowerCase()).toString();
          return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
        } catch {
          // fallback to UI avatar
        }
      }
      const name = user.displayName || user.email || user.username || 'Web2';
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=80`;
    }
    if (user.loginType === 'web3') {
      const addr = user.address || user.username;
      return `https://effigy.im/a/${addr}.svg`;
    }
    return `https://images.hive.blog/u/${user.username}/avatar`;
  };

  const getUserDisplayName = (user: LoggedInUser) => {
    if (user.displayName) {
      return user.displayName;
    }
    if (user.loginType === 'web2') {
      return user.email || user.username;
    }
    if (user.loginType === 'web3') {
      const addr = user.address || user.username;
      if (addr.startsWith('0x') && addr.length > 10) {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      }
      return addr;
    }
    return user.username;
  };

  const getUserSubtext = (user: LoggedInUser) => {
    const provider = getProviderName(user);
    if (user.loginType === 'web3') {
      const addr = user.address || user.username;
      const formatted = addr.startsWith('0x') && addr.length > 10
        ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
        : addr;
      return user.displayName ? `${formatted} • ${provider}` : provider;
    }
    if (user.loginType === 'web2' && user.displayName && user.email) {
      return `${user.email} • ${provider}`;
    }
    return provider;
  };

  const hasCustomLoginColors =
    loginButtonColors && loginButtonColors.length > 0;

  const addAccountButtonStyle =
    hasCustomLoginColors || loginButtonTextColor
      ? {
          ...(hasCustomLoginColors && {
            background:
              loginButtonColors!.length === 1
                ? loginButtonColors![0]
                : `linear-gradient(90deg, ${loginButtonColors!.join(", ")})`,
          }),
          ...(loginButtonTextColor && { color: loginButtonTextColor }),
        }
      : undefined;

  const currentBadgeStyle =
    hasCustomLoginColors || loginButtonTextColor
      ? {
          ...(hasCustomLoginColors && {
            background: loginButtonColors![0],
          }),
          ...(loginButtonTextColor && { color: loginButtonTextColor }),
        }
      : undefined;

  if (!isOpen) return null;

  if (showAddAccount) {
    return (
      <LoginDialog
        isOpen={true}
        onClose={handleBackFromLogin}
        showBackButton={true}
        onBack={handleBackFromLogin}
        onAuthenticate={onAuthenticate}
        aioha={aioha}
        onSignMessage={onSignMessage}
        theme={theme}
        isActiveFieldVisible={isActiveFieldVisible}
        loginButtonColors={loginButtonColors}
        loginButtonTextColor={loginButtonTextColor}
        web2Config={web2Config}
        onWeb2Authenticate={onWeb2Authenticate}
        enableWeb2Login={enableWeb2Login}
        reownConfig={reownConfig}
        onWeb3Authenticate={onWeb3Authenticate}
        enableWeb3Login={enableWeb3Login}
        onUpdateProfile={onUpdateProfile}
        hiveSignerVisible={hiveSignerVisible}
      />
    );
  }

  if (typeof document === 'undefined') return null;

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300"
          onClick={onClose}
        >
          <div
            className="relative w-full max-w-md bg-zinc-950/95 text-white rounded-3xl border border-zinc-800 shadow-[0_0_50px_rgba(227,19,55,0.15)] overflow-hidden flex flex-col p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            {/* Title */}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <h3 className="font-bold text-lg text-white">
                {shouldShowSwitchUser ? 'Switch User' : 'Logged in User'}
              </h3>
            </div>
            {/* Cross Button */}
            <button
              className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-zinc-800 cursor-pointer"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {loggedInUsers.map((user) => (
              <div
                key={user.username}
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all duration-200 ${
                  currentUser?.username === user.username
                    ? 'border-red-500/80 bg-red-500/10 shadow-[0_0_15px_rgba(227,19,55,0.15)]'
                    : 'border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700'
                }`}
                onClick={() => handleSwitchUser(user)}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={getUserAvatar(user)}
                    alt={`${getUserDisplayName(user)} avatar`}
                    className="w-11 h-11 rounded-full border border-zinc-700 object-cover bg-zinc-900"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        user.loginType === 'web2'
                          ? 'https://www.gravatar.com/avatar/?d=mp'
                          : user.loginType === 'web3'
                          ? 'https://ui-avatars.com/api/?name=W3&background=0052FF&color=fff'
                          : 'https://images.hive.blog/u/0/avatar';
                    }}
                  />
                  <img
                    src={getProviderIcon(user)}
                    alt={`${getProviderName(user)}`}
                    className="w-4 h-4 absolute -bottom-0.5 -right-0.5 bg-zinc-950 rounded-full p-0.5 border border-zinc-700 shadow-sm"
                  />
                </div>

                {/* Username & Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm text-zinc-100 truncate">
                      {getUserDisplayName(user)}
                    </p>
                    {/* Edit Profile Pencil (Web3 or Web2) */}
                    {(user.loginType === 'web3' || user.loginType === 'web2') && (
                      <button
                        type="button"
                        title="Edit profile name and avatar"
                        className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingUser(user);
                        }}
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 capitalize truncate">
                    {getUserSubtext(user)}
                  </p>
                  {/* Prompt to set profile name if not set yet */}
                  {(user.loginType === 'web3' || user.loginType === 'web2') && !user.displayName && (
                    <button
                      type="button"
                      className="mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white flex items-center gap-1 shadow-sm cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingUser(user);
                      }}
                    >
                      ✨ Set Profile Name & Avatar
                    </button>
                  )}
                </div>

                {/* Status/Action */}
                <div className="flex items-center gap-2">
                  {currentUser?.username === user.username ? (
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-600 text-white"
                      style={currentBadgeStyle}
                    >
                      Current
                    </span>
                  ) : (
                    <button
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLogoutUser(user);
                      }}
                    >
                      Logout
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Actions */}
          <div className="pt-2 space-y-2">
            {shouldShowSwitchUser && (
              <button
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-md hover:shadow-lg cursor-pointer"
                style={addAccountButtonStyle}
                onClick={handleAddAccount}
              >
                + Add Account
              </button>
            )}

            <button
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all duration-200 border border-zinc-800 hover:border-red-900/60 bg-zinc-900/40 hover:bg-red-950/30 text-zinc-400 hover:text-red-300 cursor-pointer"
              onClick={handleLogoutAll}
            >
              {shouldShowSwitchUser ? 'Logout All' : 'Logout'}
            </button>
          </div>
        </div>
      </div>,
      document.body
      )}

      {/* Profile Edit Modal */}
      {editingUser && (
        <ProfileEditModal
          isOpen={Boolean(editingUser)}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdateProfile={onUpdateProfile}
          theme={theme}
        />
      )}
    </>
  );
};
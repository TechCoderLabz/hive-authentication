import React, { useState } from 'react';
import { LoginDialog } from './LoginDialog';
import { useAuthStore } from '../store/authStore';
import type { LoggedInUser, SwitchUserModalProps } from '../types/auth';
import { AuthService } from '../services/authService';
import KeychainIcon from '../assets/keychain.svg'
import HiveAuthIcon from '../assets/hiveauth-light.svg'
import HiveSignerIcon from '../assets/hivesigner.svg'
import PrivateKeyIcon from '../assets/privatekey.svg'
import Web2Icon from '../assets/web2.svg'
import PeakLockIcon from '../assets/peaklock.svg'

export const SwitchUserModal: React.FC<
  SwitchUserModalProps & { theme?: "light" | "dark" }
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
  hiveSignerVisible = false,
}) => {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const { currentUser, loggedInUsers, setCurrentUser, removeLoggedInUser, clearAllUsers } = useAuthStore();

  const handleSwitchUser = async (user: LoggedInUser) => {
    setCurrentUser(user);
    // Web2 users don't need aioha switching
    if (user.loginType === 'web2') {
      onClose();
      return;
    }
    if (user.privatePostingKey) {
      const currentLoggedInUser = aioha.getCurrentUser();
      const otherLogins = aioha.getOtherLogins();
      if (currentLoggedInUser === user.username.trim()) {
        aioha.logout();
        await new Promise(resolve => setTimeout(resolve, 500));
      } else if (otherLogins && otherLogins[user.username.trim()]) {
        AuthService.removeUser(aioha, user.username.trim());
      }
      await AuthService.switchUserWithPrivatePostingKey(aioha, user.username, user.privatePostingKey, onSignMessage(user.username.trim().toLocaleLowerCase()));
    }
    AuthService.switchUser(aioha, user.username);
    onClose();
  };
  const handleLogoutUser = (user: LoggedInUser) => {
    removeLoggedInUser(user.username);
    if (user.loginType !== 'web2') {
      AuthService.removeUser(aioha, user.username);
    }
  };
  const handleLogoutAll = async () => {
    try {
      aioha.logout();
      // Get all other logged in users
      const otherLogins = aioha.getOtherLogins();
      // Logout each user one by one
      for (const user of Object.keys(otherLogins)) {
        AuthService.removeUser(aioha, user);
      }
      // Clear app state / storage
      clearAllUsers();
      // Close modal or drawer
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
    if (user.loginType === 'web2') return Web2Icon;
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
    }
  };

  const getProviderName = (user: LoggedInUser) => {
    if (user.loginType === 'web2') {
      return user.web2Provider === 'google' ? 'Google' : 'Email';
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
    }
  };


  const getUserAvatar = (user: LoggedInUser) => {
    if (user.loginType === 'web2') {
      if (user.photoURL) return user.photoURL;
      return 'https://www.gravatar.com/avatar/?d=mp';
    }
    return `https://images.hive.blog/u/${user.username}/avatar`;
  };

  const getUserDisplayName = (user: LoggedInUser) => {
    if (user.loginType === 'web2') {
      return user.displayName || user.email || user.username;
    }
    return user.username;
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
        hiveSignerVisible={hiveSignerVisible}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300"
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
            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-zinc-800"
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
                  className="w-10 h-10 rounded-full border border-zinc-700 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      user.loginType === 'web2'
                        ? 'https://www.gravatar.com/avatar/?d=mp'
                        : 'https://images.hive.blog/u/0/avatar';
                  }}
                />
                <img
                  src={getProviderIcon(user)}
                  alt={`${getProviderName(user)}`}
                  className="w-4 h-4 absolute -bottom-0.5 -right-0.5 bg-zinc-950 rounded-full p-0.5 border border-zinc-700"
                />
              </div>

              {/* Username */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-zinc-100 truncate">
                  {getUserDisplayName(user)}
                </p>
                <p className="text-xs text-zinc-400 capitalize">
                  {getProviderName(user)}
                </p>
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
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-colors"
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
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-md hover:shadow-lg"
              style={addAccountButtonStyle}
              onClick={handleAddAccount}
            >
              + Add Account
            </button>
          )}

          <button
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all duration-200 border border-zinc-800 hover:border-red-900/60 bg-zinc-900/40 hover:bg-red-950/30 text-zinc-400 hover:text-red-300"
            onClick={handleLogoutAll}
          >
            {shouldShowSwitchUser ? 'Logout All' : 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { LoginDialog } from './LoginDialog';
import { useAuthStore } from '../store/authStore';
import type { LoggedInUser, SwitchUserModalProps } from '../types/auth';
import { AuthService } from '../services/authService';
import KeychainIcon from '../assets/keychain.svg'
import HiveAuthIcon from '../assets/hiveauth-light.svg'
import PrivateKeyIcon from '../assets/privatekey.svg'
import Web2Icon from '../assets/web2.svg'

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
      case 'privatePostingKey':
        return PrivateKeyIcon;
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
      case 'privatePostingKey':
        return 'PrivateKey';
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
      />
    );
  }

  return (
    <div
      className={`modal modal-open ${
        theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-black"
      }`}
    >
      <div
        className={`modal-box absolute ${
          theme === "dark" ? "bg-gray-900" : "bg-white"
        }`}
      >

        <div className="flex items-center justify-between mb-4">
          {/* Title */}
          <h3 className="font-bold text-lg text-center">
            {shouldShowSwitchUser ? "Switch User" : "Logged in User"}
          </h3>
          {/* Cross Button */}
          <button
            className={`btn btn-sm btn-circle btn-ghost ${
              theme === "dark"
                ? "bg-gray-700 hover:bg-gray-600"
                : "bg-gray-100 hover:bg-gray-200 border border-gray-300 text-black"
            }`}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {loggedInUsers.map((user) => (
            <div
              key={user.username}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                currentUser?.username === user.username
                  ? 'border-primary bg-primary/10' 
                  : 'border-base-300 hover:border-primary/50'
              }`}
              onClick={() => handleSwitchUser(user)}
            >
              {/* Avatar */}
              <div className="avatar">
                <div className="w-10 h-10 rounded-full">
                  <img
                    src={getUserAvatar(user)}
                    alt={`${getUserDisplayName(user)} avatar`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = user.loginType === 'web2'
                        ? 'https://www.gravatar.com/avatar/?d=mp'
                        : 'https://images.hive.blog/u/0/avatar';
                    }}
                  />
                </div>
              </div>
              <div className='avatar'>
                <div className='w-10 h-10 rounded-full'>
                  <img src={getProviderIcon(user)} alt={`${getProviderName(user)}`} />
                </div>
              </div>

              {/* Username */}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium truncate ${
                    theme === "dark" ? "text-white" : "text-black"
                  }`}
                >
                  {getUserDisplayName(user)}
                </p>
                <p
                  className={`text-sm capitalize ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {getProviderName(user)}
                </p>
              </div>

              {/* Status/Action */}
              <div className="flex items-center gap-2">
                {currentUser?.username === user.username ? (
                  <span
                    className="badge badge-primary badge-sm"
                    style={currentBadgeStyle}
                  >
                    Current
                  </span>
                ) : (
                  <button
                    className="btn btn-xs btn-outline btn-error"
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
        <div className="modal-action flex-col gap-2">
          {
            shouldShowSwitchUser &&
            <button
              className={`btn w-full ${
                hasCustomLoginColors
                  ? "border-none focus:outline-none focus:ring-0"
                  : theme === "dark"
                  ? "bg-primary text-white hover:bg-primary-focus"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
              style={addAccountButtonStyle}
              onClick={handleAddAccount}
            >
              Add Account
            </button>
          }


          <button
            className={`btn ${
              theme === "dark"
                ? "btn-outline btn-error text-white"
                : "btn-outline btn-error text-black"
            } w-full`}
            onClick={handleLogoutAll}
          >
            {shouldShowSwitchUser ? "Logout All" : "Logout"}
          </button>
        </div>
      </div>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};
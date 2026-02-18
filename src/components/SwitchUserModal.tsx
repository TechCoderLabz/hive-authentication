import React, { useState } from 'react';
import { LoginDialog } from './LoginDialog';
import { useAuthStore } from '../store/authStore';
import type { LoggedInUser, SwitchUserModalProps } from '../types/auth';
import { AuthService } from '../services/authService';
import KeychainIcon from '../assets/keychain.svg'
import HiveAuthIcon from '../assets/hiveauth-light.svg'
import PrivateKeyIcon from '../assets/privatekey.svg'

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
}) => {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const { currentUser, loggedInUsers, setCurrentUser, removeLoggedInUser, clearAllUsers } = useAuthStore();

  const handleSwitchUser = async (user: LoggedInUser) => {
    setCurrentUser(user);
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
  const handleLogoutUser = (username: string) => {
    removeLoggedInUser(username);
    AuthService.removeUser(aioha, username);
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

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'keychain':
        return KeychainIcon;
      case 'hiveauth':
        return HiveAuthIcon;
      case 'privatePostingKey':
        return PrivateKeyIcon;
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'keychain':
        return 'Keychain';
      case 'hiveauth':
        return 'HiveAuth';
      case 'privatePostingKey':
        return 'PrivateKey';
    }
  };

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
                    src={`https://images.hive.blog/u/${user.username}/avatar`}
                    alt={`${user.username} avatar`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.hive.blog/u/0/avatar';
                    }}
                  />
                </div>
              </div>
              <div className='avatar'>
                <div className='w-10 h-10 rounded-full'>
                  <img src={getProviderIcon(user.provider)} alt={`${getProviderName(user.provider)}`} />
                </div>
              </div>

              {/* Username */}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium truncate ${
                    theme === "dark" ? "text-white" : "text-black"
                  }`}
                >
                  {user.username}
                </p>
                <p
                  className={`text-sm capitalize ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {getProviderName(user.provider)}
                </p>
              </div>

              {/* Status/Action */}
              <div className="flex items-center gap-2">
                {currentUser?.username === user.username ? (
                  <span className="badge badge-primary badge-sm">Current</span>
                ) : (
                  <button
                    className="btn btn-xs btn-outline btn-error"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogoutUser(user.username);
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
              className={`btn ${
                theme === "dark"
                  ? "bg-primary text-white hover:bg-primary-focus"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              } w-full`}
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
import React, { useEffect, useState } from "react";
import CryptoJS from "crypto-js";
import { useAuthStore } from "../store/authStore";
import { LoginDialog } from "./LoginDialog";
import { SwitchUserModal } from "./SwitchUserModal";
import { ProfileEditModal } from "./ProfileEditModal";
import type { AuthButtonProps } from "../types/auth";

export const AuthButton: React.FC<
  AuthButtonProps & {
    theme?: "light" | "dark";
    onUpdateProfile?: (profile: { username: string; displayName?: string; photoURL?: string }) => Promise<void>;
  }
> = ({
  encryptionKey,
  onAuthenticate,
  aioha,
  shouldShowSwitchUser = true,
  isActiveFieldVisible = false,
  onClose,
  onSignMessage,
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
  theme = "light", // Default to "light" theme
}) => {
  const { setHiveAuthPayload, setSecretKey, setAioha } = useAuthStore();
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isSwitchUserModalOpen, setIsSwitchUserModalOpen] = useState(false);
  const [isProfileSetupOpen, setIsProfileSetupOpen] = useState(false);
  const { currentUser } = useAuthStore();

  useEffect(() => {
    setSecretKey(encryptionKey);
    setAioha(aioha);
  }, [encryptionKey]);

  useEffect(() => {
    aioha.on("hiveauth_login_request", (payload: string) => {
      setHiveAuthPayload(payload);
    });
  }, [aioha]);

  // Prompt profile setup for Web3/Web2 users when they log in without a displayName
  useEffect(() => {
    if (
      currentUser &&
      (currentUser.loginType === 'web3' || currentUser.loginType === 'web2') &&
      !currentUser.displayName
    ) {
      const promptKey = `hs_profile_prompted_${currentUser.username}`;
      if (!sessionStorage.getItem(promptKey)) {
        sessionStorage.setItem(promptKey, '1');
        setIsProfileSetupOpen(true);
      }
    }
  }, [currentUser]);

  const handleButtonClick = () => {
    if (currentUser) {
      // Show switch user modal
      setIsSwitchUserModalOpen(true);
    } else {
      // Open login dialog
      setIsLoginDialogOpen(true);
    }
  };

  const getAvatarUrl = () => {
    if (currentUser?.photoURL) {
      return currentUser.photoURL;
    }
    if (currentUser?.loginType === 'web2') {
      // Use Google photo or Gravatar for email users
      if (currentUser.email) {
        const hash = CryptoJS.MD5(currentUser.email.trim().toLowerCase()).toString();
        return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
      }
      return 'https://www.gravatar.com/avatar/?d=identicon';
    }
    if (currentUser?.loginType === 'web3') {
      const addr = currentUser.address || currentUser.username;
      return `https://effigy.im/a/${addr}.svg`;
    }
    return `https://images.hive.blog/u/${currentUser?.username}/avatar`;
  };

  const getDisplayName = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName;
    }
    if (currentUser?.loginType === 'web2') {
      return currentUser.email || currentUser.username;
    }
    if (currentUser?.loginType === 'web3') {
      const addr = currentUser.address || currentUser.username;
      if (addr.startsWith('0x') && addr.length > 10) {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      }
      return addr;
    }
    return currentUser?.username;
  };

  const hasCustomLoginColors =
    loginButtonColors && loginButtonColors.length > 0;

  const loginButtonStyle: React.CSSProperties | undefined =
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

  return (
    <>
      {currentUser ? (
        <div
          className={`flex flex-col items-center cursor-pointer ${
            theme === "dark" ? "text-gray-300" : "text-gray-700"
          }`}
          onClick={handleButtonClick}
          id="user-button"
        >
          <div className="avatar">
            <div className="w-7 h-7 rounded-full">
              <img
                src={getAvatarUrl()}
                alt={`${getDisplayName()} avatar`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    currentUser?.loginType === 'web2'
                      ? "https://www.gravatar.com/avatar/?d=mp"
                      : currentUser?.loginType === 'web3'
                      ? "https://ui-avatars.com/api/?name=W3&background=0052FF&color=fff"
                      : "https://images.hive.blog/u/0/avatar";
                }}
              />
            </div>
          </div>
          <div
            className={`text-sm ${
              theme === "dark" ? "text-gray-300" : "text-gray-800"
            }`}
          >
            {getDisplayName()}
          </div>
        </div>
      ) : (
        <button
          className={`btn ${
            hasCustomLoginColors
              ? `border-none focus:outline-none focus:ring-0 ${
                  theme === "dark" ? "text-white" : "text-black"
                }`
              : theme === "dark"
              ? "bg-primary text-white hover:bg-primary-focus border-none"
              : "btn-primary"
          }`}
          style={loginButtonStyle}
          onClick={handleButtonClick}
        >
          Login
        </button>
      )}

      <LoginDialog
        isOpen={isLoginDialogOpen}
        onClose={() => {
          setIsLoginDialogOpen(false);
          onClose?.();
        }}
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

      <SwitchUserModal
        isOpen={isSwitchUserModalOpen}
        shouldShowSwitchUser={shouldShowSwitchUser ?? true}
        isActiveFieldVisible={isActiveFieldVisible}
        onClose={() => {
          setIsSwitchUserModalOpen(false);
          onClose?.();
        }}
        onAuthenticate={onAuthenticate}
        aioha={aioha}
        onSignMessage={onSignMessage}
        theme={theme}
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

      {/* Auto-Prompt Profile Setup Modal if user has no display name */}
      {isProfileSetupOpen && currentUser && (
        <ProfileEditModal
          isOpen={isProfileSetupOpen}
          user={currentUser}
          onClose={() => setIsProfileSetupOpen(false)}
          onUpdateProfile={onUpdateProfile}
          theme={theme}
        />
      )}
    </>
  );
};

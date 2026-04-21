import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { LoginDialog } from "./LoginDialog";
import { SwitchUserModal } from "./SwitchUserModal";
import type { AuthButtonProps } from "../types/auth";

export const AuthButton: React.FC<
  AuthButtonProps & { theme?: "light" | "dark" }
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
  hiveSignerVisible = false,
  theme = "light", // Default to "light" theme
}) => {
  const { setHiveAuthPayload, setSecretKey, setAioha } = useAuthStore();
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isSwitchUserModalOpen, setIsSwitchUserModalOpen] = useState(false);
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
    if (currentUser?.loginType === 'web2') {
      // Use Google photo or Gravatar for email users
      if (currentUser.photoURL) return currentUser.photoURL;
      // Gravatar fallback using email
      if (currentUser.email) {
        return `https://www.gravatar.com/avatar/?d=mp`;
      }
      return 'https://www.gravatar.com/avatar/?d=mp';
    }
    return `https://images.hive.blog/u/${currentUser?.username}/avatar`;
  };

  const getDisplayName = () => {
    if (currentUser?.loginType === 'web2') {
      return currentUser.displayName || currentUser.email || currentUser.username;
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
          className={`flex flex-col items-center ${
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
                    "https://www.gravatar.com/avatar/?d=mp";
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
        hiveSignerVisible={hiveSignerVisible}
      />
    </>
  );
};

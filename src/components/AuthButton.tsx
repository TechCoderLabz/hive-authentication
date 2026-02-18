import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { setEncryptionKey } from "../constants/encryptionKey";
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
  theme = "light", // Default to "light" theme
}) => {
  setEncryptionKey(encryptionKey);
  const { setHiveAuthPayload, rehydrateFromStorage } = useAuthStore();
  React.useEffect(() => {
    rehydrateFromStorage();
  }, [rehydrateFromStorage]);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isSwitchUserModalOpen, setIsSwitchUserModalOpen] = useState(false);
  const { currentUser } = useAuthStore();

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
  const getAvatarUrl = (username: string) => {
    return `https://images.hive.blog/u/${username}/avatar`;
  };
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
                src={getAvatarUrl(currentUser.username)}
                alt={`${currentUser.username} avatar`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.hive.blog/u/0/avatar";
                }}
              />
            </div>
          </div>
          <div
            className={`text-sm ${
              theme === "dark" ? "text-gray-300" : "text-gray-800"
            }`}
          >
            {currentUser.username}
          </div>
        </div>
      ) : (
        <button
          className={`btn ${
            theme === "dark"
              ? "bg-primary text-white hover:bg-primary-focus border-none"
              : "btn-primary"
          }`}
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
      />
    </>
  );
};

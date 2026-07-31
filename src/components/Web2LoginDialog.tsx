import React, { useState } from 'react';
import { FirebaseAuthService } from '../services/firebaseAuthService';
import { useAuthStore } from '../store/authStore';
import type { Web2Config, Web2AuthResult } from '../types/auth';

interface Web2LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  embedded?: boolean;
  web2Config: Web2Config;
  onWeb2Authenticate: (web2Result: Web2AuthResult) => Promise<string>;
  theme?: 'light' | 'dark';
  loginButtonColors?: string[];
  loginButtonTextColor?: string;
}

export const Web2LoginDialog: React.FC<Web2LoginDialogProps> = ({
  isOpen,
  onClose,
  onBack,
  embedded = false,
  web2Config,
  onWeb2Authenticate,
  theme = 'light',
  loginButtonColors,
  loginButtonTextColor,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<'google' | 'apple' | null>(null);

  const { authenticateWeb2WithCallback } = useAuthStore();

  const hasCustomLoginColors = loginButtonColors && loginButtonColors.length > 0;

  const loginButtonStyle = hasCustomLoginColors
    ? {
        background:
          loginButtonColors!.length === 1
            ? loginButtonColors![0]
            : `linear-gradient(90deg, ${loginButtonColors!.join(', ')})`,
      }
    : undefined;

  const handleWeb2Auth = async (result: Web2AuthResult) => {
    await authenticateWeb2WithCallback(result, onWeb2Authenticate);
    onClose();
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoadingAction('google');
    try {
      const result = await FirebaseAuthService.loginWithGoogle(web2Config);
      await handleWeb2Auth(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google login failed';
      setError(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAppleLogin = async () => {
    setError(null);
    setLoadingAction('apple');
    try {
      const result = await FirebaseAuthService.loginWithApple(web2Config);
      await handleWeb2Auth(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Apple login failed';
      setError(message);
    } finally {
      setLoadingAction(null);
    }
  };

  if (!isOpen) return null;

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        {onBack && (
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={() => {
              setError(null);
              onBack();
            }}
          >
            ←
          </button>
        )}

        <h3
          className="font-bold text-lg flex-1 text-center"
          style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}
        >
          Web2 Login
        </h3>

        <button
          className={`btn btn-sm btn-circle btn-ghost ${
            theme === 'dark'
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
          }`}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 mt-6">
        {/* Google Login Button */}
        <button
          className={`btn w-full ${
            hasCustomLoginColors
              ? `border-none focus:outline-none focus:ring-0 ${
                  theme === 'dark' ? 'text-white' : 'text-black'
                }`
              : theme === 'dark'
              ? 'bg-primary text-white hover:bg-primary-focus border-none'
              : 'bg-blue-500 text-white hover:bg-blue-600 border-none'
          }`}
          style={loginButtonStyle}
          onClick={handleGoogleLogin}
          disabled={!!loadingAction}
        >
          {loadingAction === 'google' ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span
            style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}
          >
            Login with Google
          </span>
        </button>

        {/* Apple Login Button */}
        <button
          className={`btn w-full ${
            hasCustomLoginColors
              ? `border-none focus:outline-none focus:ring-0 ${
                  theme === 'dark' ? 'text-white' : 'text-black'
                }`
              : theme === 'dark'
              ? 'bg-primary text-white hover:bg-primary-focus border-none'
              : 'bg-blue-500 text-white hover:bg-blue-600 border-none'
          }`}
          style={loginButtonStyle}
          onClick={handleAppleLogin}
          disabled={!!loadingAction}
        >
          {loadingAction === 'apple' ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.365 1.43c0 1.14-.415 2.09-1.246 2.86-.943.86-2.03 1.35-3.02 1.28-.13-1.02.36-2.09 1.24-2.9.9-.85 2.05-1.29 3.026-1.24zM20.6 17.11c-.44 1.02-.97 1.97-1.66 2.85-.94 1.2-1.71 2.02-2.3 2.47-.9.7-1.87 1.06-2.9.08-.75-.65-1.63-1-2.66-1-.06 0-.13 0-.19.01-1.02.02-1.9.36-2.65.99-1.02.86-1.98.44-2.85-.34-.72-.65-1.6-1.62-2.62-2.9-1.1-1.4-2.02-3.03-2.72-4.9-.75-2.02-1.13-3.97-1.13-5.85 0-2.15.47-4 1.4-5.55.92-1.53 2.28-2.32 4.05-2.35.83 0 1.9.32 3.2.94.83.4 1.4.6 1.7.6.24 0 .82-.23 1.75-.7 1.32-.63 2.4-.87 3.24-.72 2.02.16 3.53 1.02 4.53 2.6-1.8 1.1-2.7 2.63-2.68 4.62.02 1.55.58 2.84 1.68 3.87.5.47 1.06.83 1.68 1.09-.13.4-.28.79-.44 1.18z"/>
            </svg>
          )}
          <span
            style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}
          >
            Login with Apple
          </span>
        </button>
      </div>

      {error && (
        <div className="alert alert-error mt-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div
      className={`modal modal-open ${
        theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'
      }`}
    >
      <div
        className={`modal-box absolute ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-white'
        }`}
      >
        {content}
      </div>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};

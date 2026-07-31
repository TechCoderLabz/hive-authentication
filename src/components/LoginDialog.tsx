/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { AuthService } from '../services/authService';
import { FirebaseAuthService } from '../services/firebaseAuthService';
import type { LoginDialogProps, Web2Config, Web2AuthResult } from '../types/auth';
import QRCode from 'qrcode';
import { Providers } from '@aioha/aioha';
import KeychainIcon from '../assets/keychain.svg';
import HiveAuthIcon from '../assets/hiveauth-light.svg';
import HiveSignerIcon from '../assets/hivesigner.svg';
import PrivateKeyIcon from '../assets/privatekey.svg';
import PeakLockIcon from '../assets/peaklock.svg';
import {
  getPeakLockAccounts,
  savePeakLockAccount,
  decryptPeakLockKey,
  removePeakLockAccount,
  type PeakLockAccount,
} from '../utils/peakLockStorage';

export const LoginDialog: React.FC<
  LoginDialogProps & {
    theme?: 'light' | 'dark';
    web2Config?: Web2Config;
    onWeb2Authenticate?: (web2Result: Web2AuthResult) => Promise<string>;
  }
> = ({
  isOpen,
  onClose,
  showBackButton = false,
  onBack,
  onAuthenticate,
  aioha,
  onSignMessage,
  theme = 'dark',
  isActiveFieldVisible = false,
  loginButtonColors,
  loginButtonTextColor,
  web2Config,
  onWeb2Authenticate,
  enableWeb2Login = false,
  hiveSignerVisible = false,
}) => {
  // Web2 state
  const [web2Loading, setWeb2Loading] = useState<'google' | 'apple' | null>(null);

  // Web3 state
  const [selectedWeb3Method, setSelectedWeb3Method] = useState<
    'none' | 'keychain' | 'hiveauth' | 'hivesigner' | 'privateKey' | 'peaklock'
  >('none');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState('');
  const [privateActiveKey, setPrivateActiveKey] = useState('');

  // PeakLock state
  const [peakLockAccounts, setPeakLockAccounts] = useState<PeakLockAccount[]>([]);
  const [selectedPeakLockAccount, setSelectedPeakLockAccount] = useState<PeakLockAccount | null>(null);
  const [peakLockMode, setPeakLockMode] = useState<'select' | 'add' | 'unlock'>('select');
  const [peakLockPin, setPeakLockPin] = useState('');
  const [peakLockNewUsername, setPeakLockNewUsername] = useState('');
  const [peakLockNewPostingKey, setPeakLockNewPostingKey] = useState('');
  const [peakLockNewPin, setPeakLockNewPin] = useState('');

  // Common state
  const [error, setError] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [isKeychainEnabled, setIsKeychainEnabled] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hasWeb2Config = enableWeb2Login === true && !!web2Config && !!onWeb2Authenticate;

  // Top-level navigation: choice screen -> web2 (Google/Apple) or web3 (Hive methods)
  const [mainView, setMainView] = useState<'choice' | 'web2' | 'web3'>(hasWeb2Config ? 'choice' : 'web3');

  const { isLoading, authenticateWithCallback, authenticateWeb2WithCallback, hiveAuthPayload, setHiveAuthPayload, currentUser } =
    useAuthStore();

  useEffect(() => {
    if (isOpen && selectedWeb3Method === 'peaklock') {
      const accs = getPeakLockAccounts();
      setPeakLockAccounts(accs);
      setPeakLockMode(accs.length === 0 ? 'add' : 'select');
    }
  }, [isOpen, selectedWeb3Method]);

  useEffect(() => {
    if (username.trim()) {
      setAvatarUrl(`https://images.hive.blog/u/${username.trim().toLowerCase()}/avatar`);
    } else {
      setAvatarUrl(null);
    }
  }, [username]);

  useEffect(() => {
    if (hiveAuthPayload) {
      handleHiveAuthRequest(hiveAuthPayload);
    }
  }, [hiveAuthPayload]);

  useEffect(() => {
    const check = async () => {
      await new Promise((res) => setTimeout(res, 500));
      const isEnabled = aioha.isProviderEnabled(Providers.Keychain);
      setIsKeychainEnabled(isEnabled);
    };

    if (document.readyState === 'complete') {
      check();
    } else {
      window.addEventListener('load', check);
      return () => window.removeEventListener('load', check);
    }
  }, []);

  const handleHiveAuthRequest = async (payload: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(payload, {
        width: 220,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      setQrCodeDataUrl(qrDataUrl);
      setShowQRCode(true);
      startTimer();
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      setError('Failed to generate QR code for HiveAuth');
    }
  };

  const startTimer = () => {
    setTimeRemaining(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setShowQRCode(false);
          setHiveAuthPayload(null);
          setQrCodeDataUrl('');
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setShowQRCode(false);
      setSelectedWeb3Method('none');
      setMainView(hasWeb2Config ? 'choice' : 'web3');
    }
  }, [isOpen, hasWeb2Config]);

  // Web2 Authentication Handlers
  const handleGoogleLogin = async () => {
    if (!web2Config || !onWeb2Authenticate) return;
    setError(null);
    setWeb2Loading('google');
    try {
      const result = await FirebaseAuthService.loginWithGoogle(web2Config);
      await authenticateWeb2WithCallback(result, onWeb2Authenticate);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Google login failed');
    } finally {
      setWeb2Loading(null);
    }
  };

  const handleAppleLogin = async () => {
    if (!web2Config || !onWeb2Authenticate) return;
    setError(null);
    setWeb2Loading('apple');
    try {
      const result = await FirebaseAuthService.loginWithApple(web2Config);
      await authenticateWeb2WithCallback(result, onWeb2Authenticate);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Apple login failed');
    } finally {
      setWeb2Loading(null);
    }
  };

  // Web3 Authentication Handlers
  const handleLoginWithMethod = async (method: 'keychain' | 'hiveauth' | 'hivesigner' | 'privateKey') => {
    if (!username.trim()) {
      setError('Please enter your Hive username');
      return;
    }
    if (method === 'privateKey' && !privateKey.trim()) {
      setError('Please enter your private posting key');
      return;
    }

    setError(null);
    setHiveAuthPayload(null);
    setShowQRCode(false);
    setQrCodeDataUrl('');
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const cleanUsername = username.trim().toLowerCase();
      const proof = onSignMessage(cleanUsername);

      const currentLoggedInUser = aioha.getCurrentUser();
      const otherLogins = aioha.getOtherLogins();
      if (currentLoggedInUser === cleanUsername) {
        aioha.logout();
        await new Promise((res) => setTimeout(res, 500));
      } else if (otherLogins && otherLogins[cleanUsername]) {
        AuthService.removeUser(aioha, cleanUsername);
      }

      let hiveResult;
      switch (method) {
        case 'keychain':
          hiveResult = await AuthService.loginWithHiveKeychain(aioha, cleanUsername, proof);
          break;
        case 'hiveauth':
          hiveResult = await AuthService.loginWithHiveAuth(aioha, cleanUsername, proof);
          break;
        case 'hivesigner':
          hiveResult = await AuthService.loginWithHiveSigner(aioha, cleanUsername, proof);
          break;
        case 'privateKey':
          hiveResult = await AuthService.loginWithPrivatePostingKey(
            aioha,
            cleanUsername,
            privateKey.trim(),
            proof,
            privateActiveKey.trim() || undefined
          );
          break;
      }

      if (!onAuthenticate) {
        throw new Error('No authentication callback provided. Please supply onAuthenticate prop to AuthButton.');
      }

      await authenticateWithCallback(hiveResult, onAuthenticate);
      onClose();
    } catch (err: any) {
      if (currentUser) {
        aioha.switchUser(currentUser.username);
        aioha.removeOtherLogin(username.trim().toLowerCase());
      }
      setError(err?.message || 'Authentication failed. Please verify your credentials.');
    }
  };

  const handlePeakLockLogin = async (targetUsername: string, targetPostingKey: string) => {
    if (!targetUsername.trim() || !targetPostingKey.trim()) {
      setError('Username and posting key are required for PeakLock');
      return;
    }
    const cleanUsername = targetUsername.trim().toLowerCase();
    setError(null);
    try {
      const currentLoggedInUser = aioha.getCurrentUser();
      const otherLogins = aioha.getOtherLogins();
      if (currentLoggedInUser === cleanUsername) {
        aioha.logout();
        await new Promise((res) => setTimeout(res, 500));
      } else if (otherLogins && otherLogins[cleanUsername]) {
        AuthService.removeUser(aioha, cleanUsername);
      }

      const proof = onSignMessage(cleanUsername);
      const hiveResult = await AuthService.loginWithPeakLock(aioha, cleanUsername, targetPostingKey.trim(), proof);

      if (!onAuthenticate) {
        throw new Error('No authentication callback provided.');
      }

      await authenticateWithCallback(hiveResult, onAuthenticate);
      onClose();
    } catch (err: any) {
      if (currentUser) {
        aioha.switchUser(currentUser.username);
        aioha.removeOtherLogin(cleanUsername);
      }
      setError(err?.message || 'PeakLock authentication failed.');
    }
  };

  const handleSavePeakLockAccount = async () => {
    if (!peakLockNewUsername.trim() || !peakLockNewPostingKey.trim() || !peakLockNewPin.trim()) {
      setError('Please enter username, posting key, and PIN code');
      return;
    }
    if (peakLockNewPin.trim().length < 4) {
      setError('PIN code must be at least 4 digits');
      return;
    }
    const cleanUsername = peakLockNewUsername.trim().toLowerCase();
    savePeakLockAccount(cleanUsername, peakLockNewPostingKey, peakLockNewPin);
    const updated = getPeakLockAccounts();
    setPeakLockAccounts(updated);
    await handlePeakLockLogin(cleanUsername, peakLockNewPostingKey);
  };

  const handleUnlockPeakLockAccount = async () => {
    if (!selectedPeakLockAccount || !peakLockPin.trim()) {
      setError('Please enter your PIN code');
      return;
    }
    const decryptedKey = decryptPeakLockKey(selectedPeakLockAccount.encryptedKey, peakLockPin);
    if (!decryptedKey) {
      setError('Invalid PIN Code');
      return;
    }
    await handlePeakLockLogin(selectedPeakLockAccount.username, decryptedKey);
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const hasCustomLoginColors = loginButtonColors && loginButtonColors.length > 0;
  const loginButtonStyle = hasCustomLoginColors
    ? {
        background:
          loginButtonColors!.length === 1
            ? loginButtonColors![0]
            : `linear-gradient(90deg, ${loginButtonColors!.join(', ')})`,
      }
    : {
        background: 'linear-gradient(135deg, #e31337 0%, #c51231 100%)',
      };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-zinc-950/95 text-white rounded-3xl border border-zinc-800 shadow-[0_0_50px_rgba(227,19,55,0.15)] overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <button
                className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                onClick={onBack}
              >
                ←
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
              <h3
                className={`font-bold text-xl tracking-tight ${isDark ? 'text-white' : 'text-zinc-100'}`}
                style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}
              >
                {showBackButton ? 'Add Account' : 'Welcome to Hive'}
              </h3>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* CHOICE SCREEN: pick Web2 or Web3 */}
          {mainView === 'choice' && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h4 className="font-bold text-base text-zinc-100">How would you like to sign in?</h4>
                <p className="text-xs text-zinc-400">Choose a login method to continue</p>
              </div>

              {hasWeb2Config && (
                <button
                  className="w-full p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(227,19,55,0.2)] flex items-center gap-3 transition-all duration-200"
                  onClick={() => {
                    setError(null);
                    setMainView('web2');
                  }}
                >
                  <span className="text-2xl">🌐</span>
                  <div className="text-left flex-1">
                    <div className="font-bold text-sm text-zinc-100">Web2 Quick Login</div>
                    <div className="text-xs text-zinc-400">Continue with Google or Apple</div>
                  </div>
                  <span className="text-zinc-500">→</span>
                </button>
              )}

              <button
                className="w-full p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(227,19,55,0.2)] flex items-center gap-3 transition-all duration-200"
                onClick={() => {
                  setError(null);
                  setMainView('web3');
                }}
              >
                <span className="text-2xl">🐝</span>
                <div className="text-left flex-1">
                  <div className="font-bold text-sm text-zinc-100">Web3 Hive Login</div>
                  <div className="text-xs text-zinc-400">Keychain, HiveAuth, Private Key & more</div>
                </div>
                <span className="text-zinc-500">→</span>
              </button>
            </div>
          )}

          {/* WEB2 VIEW: Google / Apple only */}
          {mainView === 'web2' && hasWeb2Config && (
            <div className="space-y-5">
              <button
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                onClick={() => {
                  setError(null);
                  setMainView('choice');
                }}
              >
                ← Back to login options
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🌐</span>
                <div>
                  <h4 className="font-bold text-base text-zinc-100">Web2 Quick Login</h4>
                  <p className="text-xs text-zinc-400">Instant access using your social account</p>
                </div>
              </div>

              {/* Instant Google Login Button */}
              <button
                className="w-full py-3.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-700/80 hover:border-zinc-600 font-semibold text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-md hover:shadow-lg group"
                onClick={handleGoogleLogin}
                disabled={!!web2Loading || isLoading}
              >
                {web2Loading === 'google' ? (
                  <span className="loading loading-spinner loading-sm text-red-500"></span>
                ) : (
                  <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.35 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              {/* Apple Login Button */}
              <button
                className="w-full py-3.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-700/80 hover:border-zinc-600 font-semibold text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-md hover:shadow-lg group"
                onClick={handleAppleLogin}
                disabled={!!web2Loading || isLoading}
              >
                {web2Loading === 'apple' ? (
                  <span className="loading loading-spinner loading-sm text-red-500"></span>
                ) : (
                  <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.365 1.43c0 1.14-.415 2.09-1.246 2.86-.943.86-2.03 1.35-3.02 1.28-.13-1.02.36-2.09 1.24-2.9.9-.85 2.05-1.29 3.026-1.24zM20.6 17.11c-.44 1.02-.97 1.97-1.66 2.85-.94 1.2-1.71 2.02-2.3 2.47-.9.7-1.87 1.06-2.9.08-.75-.65-1.63-1-2.66-1-.06 0-.13 0-.19.01-1.02.02-1.9.36-2.65.99-1.02.86-1.98.44-2.85-.34-.72-.65-1.6-1.62-2.62-2.9-1.1-1.4-2.02-3.03-2.72-4.9-.75-2.02-1.13-3.97-1.13-5.85 0-2.15.47-4 1.4-5.55.92-1.53 2.28-2.32 4.05-2.35.83 0 1.9.32 3.2.94.83.4 1.4.6 1.7.6.24 0 .82-.23 1.75-.7 1.32-.63 2.4-.87 3.24-.72 2.02.16 3.53 1.02 4.53 2.6-1.8 1.1-2.7 2.63-2.68 4.62.02 1.55.58 2.84 1.68 3.87.5.47 1.06.83 1.68 1.09-.13.4-.28.79-.44 1.18z"/>
                  </svg>
                )}
                <span>Continue with Apple</span>
              </button>
            </div>
          )}

          {/* WEB3 VIEW: Hive login methods */}
          {mainView === 'web3' && (
          <div className="space-y-5">
            {hasWeb2Config && selectedWeb3Method === 'none' && !showQRCode && (
              <button
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                onClick={() => {
                  setError(null);
                  setMainView('choice');
                }}
              >
                ← Back to login options
              </button>
            )}

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🐝</span>
              <div>
                <h4 className="font-bold text-base text-zinc-100">Hive Web3 Login</h4>
                <p className="text-xs text-zinc-400">Connect using Keychain, HiveAuth, or Keys</p>
              </div>
            </div>

            {/* QR Code Active View */}
            {showQRCode && hiveAuthPayload ? (
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-center space-y-3">
                <h5 className="font-bold text-sm text-zinc-200">HiveAuth Mobile Approval</h5>
                <p className="text-xs text-zinc-400">Scan QR code with your HiveAuth app</p>
                <div className="flex justify-center my-2">
                  <div className="p-3 bg-white rounded-xl shadow-lg">
                    <img
                      src={qrCodeDataUrl}
                      alt="HiveAuth QR Code"
                      className="w-40 h-40 cursor-pointer"
                      onClick={() => window.open(hiveAuthPayload)}
                    />
                  </div>
                </div>
                <div className="text-xs font-semibold text-red-400">Expires in: {timeRemaining}s</div>
                <button
                  className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300"
                  onClick={() => {
                    setShowQRCode(false);
                    setHiveAuthPayload(null);
                  }}
                >
                  Cancel QR Code
                </button>
              </div>
            ) : selectedWeb3Method === 'none' ? (
              /* Web3 Login Method Buttons (Initial State) */
              <div className="grid grid-cols-2 gap-3">
                {isKeychainEnabled && (
                  <button
                    className="p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(227,19,55,0.2)] flex flex-col items-center justify-center gap-2 transition-all duration-200 group"
                    onClick={() => {
                      setError(null);
                      setSelectedWeb3Method('keychain');
                    }}
                  >
                    <img src={KeychainIcon} alt="Keychain" className="w-9 h-9 transition-transform group-hover:scale-110" />
                    <span className="font-semibold text-xs text-zinc-200">Hive Keychain</span>
                  </button>
                )}

                <button
                  className="p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(227,19,55,0.2)] flex flex-col items-center justify-center gap-2 transition-all duration-200 group"
                  onClick={() => {
                    setError(null);
                    setSelectedWeb3Method('hiveauth');
                  }}
                >
                  <img src={HiveAuthIcon} alt="HiveAuth" className="w-9 h-9 transition-transform group-hover:scale-110" />
                  <span className="font-semibold text-xs text-zinc-200">HiveAuth Mobile</span>
                </button>

                {hiveSignerVisible && (
                  <button
                    className="p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(227,19,55,0.2)] flex flex-col items-center justify-center gap-2 transition-all duration-200 group"
                    onClick={() => {
                      setError(null);
                      setSelectedWeb3Method('hivesigner');
                    }}
                  >
                    <img src={HiveSignerIcon} alt="HiveSigner" className="w-9 h-9 transition-transform group-hover:scale-110" />
                    <span className="font-semibold text-xs text-zinc-200">HiveSigner</span>
                  </button>
                )}

                <button
                  className="p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(227,19,55,0.2)] flex flex-col items-center justify-center gap-2 transition-all duration-200 group"
                  onClick={() => {
                    setError(null);
                    setSelectedWeb3Method('privateKey');
                  }}
                >
                  <img src={PrivateKeyIcon} alt="Private Key" className="w-9 h-9 transition-transform group-hover:scale-110" />
                  <span className="font-semibold text-xs text-zinc-200">Private Key</span>
                </button>

                <button
                  className="p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(227,19,55,0.2)] flex flex-col items-center justify-center gap-2 transition-all duration-200 group col-span-2"
                  onClick={() => {
                    setError(null);
                    setSelectedWeb3Method('peaklock');
                    const accs = getPeakLockAccounts();
                    setPeakLockAccounts(accs);
                    setPeakLockMode(accs.length === 0 ? 'add' : 'select');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <img src={PeakLockIcon} alt="PeakLock" className="w-7 h-7" />
                    <span className="font-semibold text-xs text-zinc-200">PeakLock Storage</span>
                  </div>
                </button>
              </div>
            ) : (
              /* Selected Web3 Method Form & Inputs */
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="font-semibold text-sm text-zinc-200 capitalize">
                    {selectedWeb3Method === 'privateKey' ? 'Private Posting Key' : selectedWeb3Method} Login
                  </span>
                  <button
                    className="text-xs text-zinc-400 hover:text-white"
                    onClick={() => setSelectedWeb3Method('none')}
                  >
                    ← All Methods
                  </button>
                </div>

                {selectedWeb3Method === 'peaklock' ? (
                  /* PeakLock Form */
                  <div className="space-y-3">
                    {peakLockMode === 'select' && (
                      <div className="space-y-2">
                        {peakLockAccounts.map((acc) => (
                          <div
                            key={acc.username}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer hover:border-zinc-700"
                            onClick={() => {
                              setSelectedPeakLockAccount(acc);
                              setPeakLockMode('unlock');
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <img
                                src={`https://images.hive.blog/u/${acc.username}/avatar`}
                                alt={acc.username}
                                className="w-8 h-8 rounded-full"
                              />
                              <span className="font-semibold text-sm text-zinc-200">{acc.username}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-teal-400">Unlock →</span>
                              <button
                                className="text-xs text-red-500 hover:text-red-400 p-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = removePeakLockAccount(acc.username);
                                  setPeakLockAccounts(updated);
                                  if (updated.length === 0) setPeakLockMode('add');
                                }}
                                title="Remove account"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          className="w-full py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300"
                          onClick={() => setPeakLockMode('add')}
                        >
                          + Add New PeakLock Account
                        </button>
                      </div>
                    )}

                    {peakLockMode === 'add' && (
                      <div className="space-y-2.5">
                        <input
                          type="text"
                          placeholder="Hive username"
                          className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm"
                          value={peakLockNewUsername}
                          onChange={(e) => setPeakLockNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                        />
                        <input
                          type="password"
                          placeholder="Posting key"
                          className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm"
                          value={peakLockNewPostingKey}
                          onChange={(e) => setPeakLockNewPostingKey(e.target.value)}
                        />
                        <input
                          type="password"
                          placeholder="New PIN (4-6 digits)"
                          className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-center tracking-widest"
                          value={peakLockNewPin}
                          onChange={(e) => setPeakLockNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                        />
                        <button
                          className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 font-semibold text-sm transition-colors"
                          onClick={handleSavePeakLockAccount}
                          disabled={isLoading}
                        >
                          Save & Login
                        </button>
                      </div>
                    )}

                    {peakLockMode === 'unlock' && selectedPeakLockAccount && (
                      <div className="space-y-3 text-center">
                        <p className="text-xs text-zinc-400">Enter PIN for @{selectedPeakLockAccount.username}</p>
                        <input
                          type="password"
                          placeholder="PIN Code"
                          className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-center tracking-widest"
                          value={peakLockPin}
                          onChange={(e) => setPeakLockPin(e.target.value.replace(/[^0-9]/g, ''))}
                        />
                        <button
                          className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 font-semibold text-sm transition-colors"
                          onClick={handleUnlockPeakLockAccount}
                          disabled={isLoading}
                        >
                          Unlock Account
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standard Web3 Method Username/Key Inputs */
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {avatarUrl && (
                        <img
                          src={avatarUrl}
                          alt="Avatar"
                          className="w-10 h-10 rounded-full border border-red-500/50 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.hive.blog/u/0/avatar';
                          }}
                        />
                      )}
                      <input
                        type="text"
                        placeholder="Hive username (e.g. alice)"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm focus:border-red-500 focus:outline-none"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                      />
                    </div>

                    {selectedWeb3Method === 'privateKey' && (
                      <>
                        <input
                          type="password"
                          placeholder="Private Posting Key (5K...)"
                          className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm focus:border-red-500 focus:outline-none"
                          value={privateKey}
                          onChange={(e) => setPrivateKey(e.target.value)}
                        />
                        {isActiveFieldVisible && (
                          <input
                            type="password"
                            placeholder="Private Active Key (optional)"
                            className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm focus:border-red-500 focus:outline-none"
                            value={privateActiveKey}
                            onChange={(e) => setPrivateActiveKey(e.target.value)}
                          />
                        )}
                      </>
                    )}

                    <button
                      className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                      style={loginButtonStyle}
                      onClick={() => handleLoginWithMethod(selectedWeb3Method as any)}
                      disabled={isLoading || !username.trim()}
                    >
                      {isLoading ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        `Continue with ${selectedWeb3Method === 'privateKey' ? 'Key' : selectedWeb3Method}`
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-6 mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center justify-between gap-2">
            <span>{error}</span>
            <button className="text-red-400 hover:text-white" onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
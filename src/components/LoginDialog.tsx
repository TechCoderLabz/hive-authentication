import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { AuthService } from '../services/authService';
import type { LoginDialogProps } from '../types/auth';
import QRCode from 'qrcode';
import { Providers } from '@aioha/aioha';
import KeychainIcon from '../assets/keychain.svg'
import HiveAuthIcon from '../assets/hiveauth-light.svg'
import PrivateKeyIcon from '../assets/privatekey.svg'

export const LoginDialog: React.FC<
  LoginDialogProps & { theme?: "light" | "dark" }
> = ({
  isOpen,
  onClose,
  showBackButton = false,
  onBack,
  onAuthenticate,
  aioha,
  onSignMessage,
  theme = "light",
  isActiveFieldVisible = false,
}) => {
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [loginMethod, setLoginMethod] = useState<'keychain' | 'hiveauth' | 'privateKey'>('keychain');
  const [privateKey, setPrivateKey] = useState('');
  const [privateActiveKey, setPrivateActiveKey] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isKeychainEnabled, setIsKeychainEnabled] = useState(false);

  const { isLoading, authenticateWithCallback, hiveAuthPayload, setHiveAuthPayload, currentUser } = useAuthStore();

  // to update the avatar url when the username changes
  useEffect(() => {
    if (username.trim()) {
      setAvatarUrl(`https://images.hive.blog/u/${username}/avatar`);
    } else {
      setAvatarUrl(null);
    }
  }, [username]);
  // to handle the hiveauth payload
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
      // console.log('is it keychain enabled?', isEnabled);
      if (isEnabled) {
        setLoginMethod('keychain');
      } else {
        setLoginMethod('hiveauth');
      }
    };

    if (document.readyState === "complete") {
      check();
    } else {
      window.addEventListener("load", check);
      return () => window.removeEventListener("load", check);
    }
  }, []);
  // Handle HiveAuth request and generate QR code
  const handleHiveAuthRequest = async (payload: string) => {
    try {
      // Generate QR code from payload
      const qrDataUrl = await QRCode.toDataURL(payload, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCodeDataUrl(qrDataUrl);
      setShowQRCode(true);
      // Start 30-second timer
      startTimer();
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      setError('Failed to generate QR code for HiveAuth');
    }
  };

  // Start 30-second countdown timer
  const startTimer = () => {
    setTimeRemaining(30);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timer expired, hide QR code and show login form
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          setShowQRCode(false);
          setHiveAuthPayload(null);
          setQrCodeDataUrl('');
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
  };
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  const handleLogin = async (proof: string) => {
    if (!username.trim()) return;

    // Validate private key if that method is selected
    if (loginMethod === 'privateKey' && !privateKey.trim()) {
      setError('Please enter your private posting key');
      return;
    }

    setError(null);
    setHiveAuthPayload(null);
    setShowQRCode(false);
    setQrCodeDataUrl('');

    // Clear timer if running
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {

      let hiveResult;
      const currentLoggedInUser = aioha.getCurrentUser();
      const otherLogins = aioha.getOtherLogins();
      if (currentLoggedInUser === username.trim()) {
        aioha.logout();
        await new Promise(resolve => setTimeout(resolve, 500));
      } else if (otherLogins && otherLogins[username.trim()]) {
        AuthService.removeUser(aioha, username.trim());
      }

      // Handle different login methods
      switch (loginMethod) {
        case 'keychain':
          hiveResult = await AuthService.loginWithHiveKeychain(aioha, username.trim(), proof);
          break;
        case 'hiveauth':
          hiveResult = await AuthService.loginWithHiveAuth(aioha, username.trim(), proof);
          break;
        case 'privateKey':
          hiveResult = await AuthService.loginWithPrivatePostingKey(
            aioha,
            username.trim(),
            privateKey.trim(),
            proof,
            privateActiveKey.trim() || undefined
          );
          break;
        default:
          throw new Error('Invalid login method selected');
      }

      // Check if callback is provided
      if (!onAuthenticate) {
        throw new Error('No authentication callback provided. Please supply onAuthenticate prop to AuthButton.');
      }

      // Use the callback-based authentication
      await authenticateWithCallback(
        hiveResult,
        onAuthenticate,
      );

      onClose();
    } catch (error) {
      // const errorMessage = error instanceof Error ? error.message : 'Login failed';
      if (currentUser) {
        aioha.switchUser(currentUser.username);
        aioha.removeOtherLogin(username.trim());
      }
      setError("Something went wrong. Try restarting keychain app & make sure you're connected to internet");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && username.trim() && !isLoading) {
      handleLogin(onSignMessage(username.trim().toLocaleLowerCase()));
    }
  };

  if (!isOpen) return null;

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
          {showBackButton && (
            <button
              className="btn btn-sm btn-circle btn-ghost"
              onClick={onBack}
            >
              ←
            </button>
          )}

          <h3 className="font-bold text-lg flex-1 text-center">
            {showBackButton ? 'Add Account' : 'Login with Hive'}
          </h3>

          <button
            className={`btn btn-sm btn-circle btn-ghost ${
              theme === "dark"
                ? "bg-gray-700 hover:bg-gray-600"
                : "bg-gray-100 hover:bg-gray-200 border border-gray-300"
            }`}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {/* HiveAuth QR Code Display - Show this when QR code is active */}
        {showQRCode && hiveAuthPayload && (
          <div className="text-center">
            <h4 className="font-semibold text-lg mb-4">HiveAuth Login Request</h4>
            <p className="text-sm text-gray-600 mb-4">
              Scan this QR code with your HiveAuth wallet app to approve the login for <strong>{username}</strong>
            </p>

            {/* Timer */}
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-2">QR Code expires in:</div>
              <div className="text-2xl font-bold text-primary">{timeRemaining}s</div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <div className="bg-white p-4 rounded-lg border shadow-lg">
                <img src={qrCodeDataUrl} alt="HiveAuth QR Code" className="w-48 h-48 cursor-pointer" onClick={() => window.open(hiveAuthPayload)} />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Waiting for wallet approval...
            </p>
            {/* Cancel button */}
            <button
              className="btn btn-outline btn-sm mt-4"
              onClick={() => {
                setShowQRCode(false);
                setHiveAuthPayload(null);
                setQrCodeDataUrl('');
                if (timerRef.current) {
                  clearInterval(timerRef.current);
                }
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {/* Login Form - Hide this when QR code is active */}
        {!showQRCode && (
          <>
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Hive Username</span>
              </label>
              <div className="flex items-center gap-3">
                {avatarUrl && (
                  <div className="avatar">
                    <div className="w-12 h-12 rounded-full">
                      <img
                        src={avatarUrl}
                        alt={`${username} avatar`}
                        onError={(e) => {
                          // Fallback to default avatar if image fails to load
                          (e.target as HTMLImageElement).src = 'https://images.hive.blog/u/0/avatar';
                        }}
                      />
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Enter username"
                  className={`input input-bordered flex-1 ${
                    theme === "dark"
                      ? "bg-gray-800 text-white border-gray-600"
                      : "bg-gray-100 text-black border-gray-300"
                  }`}
                  value={username}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Only allow lowercase letters, digits, dots, and hyphens
                    const filteredValue = value.toLowerCase().replace(/[^a-z0-9.-]/g, '');
                    setUsername(filteredValue);
                  }}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  pattern="[a-z0-9.-]+"
                  title="Only lowercase letters, numbers, dots, and hyphens are allowed"
                />
              </div>
            </div>

            {/* Private Key Input Fields - Only show when private key method is selected */}
            {loginMethod === 'privateKey' && (
              <>
                <div className="form-control w-full mt-4">
                  <label className="label">
                    <span className="label-text">Posting Key</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your private posting key"
                    className={`input input-bordered w-full ${
                      theme === "dark"
                        ? "bg-gray-800 text-white border-gray-600"
                        : "bg-gray-100 text-black border-gray-300"
                    }`}
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                  />
                </div>
                {isActiveFieldVisible && (
                  <div className="form-control w-full mt-4">
                    <label className="label">
                      <span className="label-text">Active Key</span>
                      <span className="label-text-alt text-gray-500">(optional)</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Enter your private active key (optional)"
                      className={`input input-bordered w-full ${
                        theme === "dark"
                          ? "bg-gray-800 text-white border-gray-600"
                          : "bg-gray-100 text-black border-gray-300"
                      }`}
                      value={privateActiveKey}
                      onChange={(e) => setPrivateActiveKey(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isLoading}
                    />
                  </div>
                )}
              </>
            )}
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-3 text-center">
                Choose your login method:
              </p>

              <div className="flex flex-row flex-wrap gap-4 justify-center items-center">
                {/* Login method options */}
                <div className="form-control" style={{ display: isKeychainEnabled ? 'flex' : 'none' }}>
                  <label
                    className={`label cursor-pointer rounded-lg px-4 py-2 transition-colors ${
                      loginMethod === "keychain"
                        ? "bg-primary text-primary-content"
                        : theme === "dark"
                        ? "border border-base-300 hover:bg-gray-700 hover:text-white"
                        : "border border-gray-300 hover:bg-gray-200 hover:text-black"
                    }`}
                  >
                    <input
                      type="radio"
                      name="loginMethod"
                      className="hidden"
                      checked={loginMethod === 'keychain'}
                      onChange={() => setLoginMethod('keychain')}
                      disabled={isLoading}
                    />
                    <span className="label-text">
                      <img src={KeychainIcon} alt="Keychain" className='w-10 h-10' />
                    </span>
                  </label>
                </div>

                <div className="form-control">
                  <label
                    className={`label cursor-pointer rounded-lg px-4 py-2 transition-colors ${
                      loginMethod === "hiveauth"
                        ? "bg-primary text-primary-content"
                        : theme === "dark"
                        ? "border border-base-300 hover:bg-gray-700 hover:text-white"
                        : "border border-gray-300 hover:bg-gray-200 hover:text-black"
                    }`}
                  >
                    <input
                      type="radio"
                      name="loginMethod"
                      className="hidden"
                      checked={loginMethod === 'hiveauth'}
                      onChange={() => setLoginMethod('hiveauth')}
                      disabled={isLoading}
                    />
                    <span className="label-text">
                      <img src={HiveAuthIcon} alt="HiveAuth" className='w-10 h-10' />
                    </span>
                  </label>
                </div>

                <div className="form-control">
                  <label
                    className={`label cursor-pointer rounded-lg px-4 py-2 transition-colors ${
                      loginMethod === "privateKey"
                        ? "bg-primary text-primary-content"
                        : theme === "dark"
                        ? "border border-base-300 hover:bg-gray-700 hover:text-white"
                        : "border border-gray-300 hover:bg-gray-200 hover:text-black"
                    }`}
                  >
                    <input
                      type="radio"
                      name="loginMethod"
                      className="hidden"
                      checked={loginMethod === 'privateKey'}
                      onChange={() => setLoginMethod('privateKey')}
                      disabled={isLoading}
                    />
                    <span className="label-text">
                      <img src={PrivateKeyIcon} alt="Private Key" className='w-10 h-10' />
                    </span>
                  </label>
                </div>
              </div>



              {/* Login Button */}
              <button
                className={`btn w-full mt-4 ${
                  theme === "dark"
                    ? "bg-primary text-white hover:bg-primary-focus border-none"
                    : "bg-blue-500 text-white hover:bg-blue-600 border-none"
                }`}
                onClick={() => {
                  handleLogin(onSignMessage(username.trim().toLocaleLowerCase()));
                }}
                disabled={isLoading || !username.trim() || (loginMethod === 'privateKey' && !privateKey.trim())}
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="alert alert-error mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};
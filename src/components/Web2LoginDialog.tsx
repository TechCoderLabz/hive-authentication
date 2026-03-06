import React, { useState } from 'react';
import { FirebaseAuthService } from '../services/firebaseAuthService';
import { useAuthStore } from '../store/authStore';
import type { Web2Config, Web2AuthResult } from '../types/auth';

function createHumanChallenge() {
  const first = Math.floor(Math.random() * 8) + 2; // 2-9
  const second = Math.floor(Math.random() * 8) + 2; // 2-9
  return {
    question: `${first} + ${second}`,
    answer: String(first + second),
  };
}

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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [humanChallenge, setHumanChallenge] = useState(createHumanChallenge);
  const [humanAnswer, setHumanAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<'google' | 'signin' | 'signup' | null>(null);

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

  const verifyHumanChallenge = () => {
    if (humanAnswer.trim() !== humanChallenge.answer) {
      setError('Human verification failed. Please solve the calculation correctly.');
      setHumanAnswer('');
      setHumanChallenge(createHumanChallenge());
      return false;
    }
    return true;
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

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    if (!verifyHumanChallenge()) {
      return;
    }
    setError(null);
    setLoadingAction('signin');
    try {
      const result = await FirebaseAuthService.signInWithEmail(web2Config, email.trim(), password);
      await handleWeb2Auth(result);
      setHumanAnswer('');
      setHumanChallenge(createHumanChallenge());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!verifyHumanChallenge()) {
      return;
    }
    setError(null);
    setLoadingAction('signup');
    try {
      const result = await FirebaseAuthService.signUpWithEmail(web2Config, email.trim(), password);
      await handleWeb2Auth(result);
      setHumanAnswer('');
      setHumanChallenge(createHumanChallenge());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loadingAction) {
      handleEmailSignIn();
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
              setShowEmailForm(false);
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
          {showEmailForm ? 'Email Login' : 'Web2 Login'}
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

      {!showEmailForm ? (
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

          {/* Email Login Button */}
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
            onClick={() => setShowEmailForm(true)}
            disabled={!!loadingAction}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M22 4L12 13 2 4"/>
            </svg>
            <span
              style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}
            >
              Login with Email
            </span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-4">
          {/* Back to methods */}
          <button
            className="btn btn-sm btn-ghost self-start"
            onClick={() => {
              setShowEmailForm(false);
              setError(null);
              setHumanAnswer('');
              setHumanChallenge(createHumanChallenge());
            }}
          >
            ← Back to login methods
          </button>

            {/* Email Field */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                className={`input input-bordered w-full ${
                  theme === 'dark'
                    ? 'bg-gray-800 text-white border-gray-600'
                    : 'bg-gray-100 text-black border-gray-300'
                }`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!!loadingAction}
              />
            </div>

            {/* Password Field */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                className={`input input-bordered w-full ${
                  theme === 'dark'
                    ? 'bg-gray-800 text-white border-gray-600'
                    : 'bg-gray-100 text-black border-gray-300'
                }`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!!loadingAction}
              />
            </div>

            {/* Human Verification (Sign Up only) */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Human verification (required for Sign In / Sign Up)</span>
              </label>
              <div className="flex gap-2 items-center">
                <span className="font-semibold min-w-20">{humanChallenge.question} =</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Answer"
                  className={`input input-bordered w-full ${
                    theme === 'dark'
                      ? 'bg-gray-800 text-white border-gray-600'
                      : 'bg-gray-100 text-black border-gray-300'
                  }`}
                  value={humanAnswer}
                  onChange={(e) => setHumanAnswer(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={!!loadingAction}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setHumanAnswer('');
                    setHumanChallenge(createHumanChallenge());
                  }}
                  disabled={!!loadingAction}
                  title="Generate new verification challenge"
                >
                  ↻
                </button>
              </div>
            </div>

            {/* Sign In Button */}
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
              onClick={handleEmailSignIn}
              disabled={!!loadingAction || !email.trim() || !password.trim() || !humanAnswer.trim()}
            >
              {loadingAction === 'signin' ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  <span style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}>
                    Signing in...
                  </span>
                </>
              ) : (
                <span style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}>
                  Sign In
                </span>
              )}
            </button>

            {/* Sign Up Button */}
            <button
              className={`btn w-full ${
                theme === 'dark'
                  ? 'btn-outline text-white hover:bg-gray-700'
                  : 'btn-outline text-black hover:bg-gray-200'
              }`}
              onClick={handleEmailSignUp}
              disabled={!!loadingAction || !email.trim() || !password.trim() || !humanAnswer.trim()}
            >
              {loadingAction === 'signup' ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  <span>Creating account...</span>
                </>
              ) : (
                <span>Sign Up (New User)</span>
              )}
            </button>
        </div>
      )}

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

import React, { useState, useEffect } from 'react';
import { FirebaseAuthService, getFirebaseApp } from '../services/firebaseAuthService';
import { useAuthStore } from '../store/authStore';
import type { Web2Config, Web2AuthResult } from '../types/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import CryptoJS from 'crypto-js';
import * as dhive from '@hiveio/dhive';
import { PlaintextKeyProvider } from '@aioha/aioha/build/providers/custom/plaintext';
import { KeyTypes, Providers } from '@aioha/aioha/build/types';
import { getHiveAuthApiNode } from '../config/hiveApi';

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
  preAuthGoogleUser?: any;
  initialStep?: 'initial' | 'email';
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
  preAuthGoogleUser,
  initialStep = 'initial',
}) => {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [humanChallenge, setHumanChallenge] = useState(createHumanChallenge);
  const [humanAnswer, setHumanAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<'google' | 'signin' | 'signup' | null>(null);

  const [web2Step, setWeb2Step] = useState<'initial' | 'decrypt' | 'link'>('initial');
  const [googleUser, setGoogleUser] = useState<Web2AuthResult | null>(null);
  const [storedHiveUser, setStoredHiveUser] = useState<{ hiveUsername: string; encryptedPostingKey: string; publicKey: string } | null>(null);
  const [masterPassword, setMasterPassword] = useState('');
  const [enteredHiveUsername, setEnteredHiveUsername] = useState('');
  const [enteredPostingKey, setEnteredPostingKey] = useState('');
  const [enteredMasterPassword, setEnteredMasterPassword] = useState('');

  const { authenticateWeb2WithCallback, aioha } = useAuthStore();

  useEffect(() => {
    if (initialStep === 'email') {
      setShowEmailForm(true);
    } else {
      setShowEmailForm(false);
    }

    if (preAuthGoogleUser) {
      const handlePreAuthGoogle = async () => {
        setLoadingAction('google');
        setError(null);
        try {
          const app = getFirebaseApp(web2Config);
          const db = getFirestore(app);
          const docRef = doc(db, 'google_hive_users', preAuthGoogleUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const storedData = docSnap.data();
            setStoredHiveUser(storedData as any);
            setGoogleUser(preAuthGoogleUser);
            setWeb2Step('decrypt');
          } else {
            setGoogleUser(preAuthGoogleUser);
            setWeb2Step('link');
          }
        } catch (e: any) {
          console.error('Error handling pre-authenticated Google user:', e);
          setError(e.message || 'Google login verification failed');
          setWeb2Step('initial');
        } finally {
          setLoadingAction(null);
        }
      };
      handlePreAuthGoogle();
    } else {
      setWeb2Step('initial');
      setStoredHiveUser(null);
      setGoogleUser(null);
    }
  }, [preAuthGoogleUser, initialStep, web2Config]);

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
      
      // Initialize Firestore
      const app = getFirebaseApp(web2Config);
      const db = getFirestore(app);
      const docRef = doc(db, 'google_hive_users', result.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setStoredHiveUser({
          hiveUsername: data.hiveUsername,
          encryptedPostingKey: data.encryptedPostingKey,
          publicKey: data.publicKey,
        });
        setGoogleUser(result);
        setWeb2Step('decrypt');
      } else {
        setGoogleUser(result);
        setWeb2Step('link');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google login failed';
      setError(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDecryptSubmit = async () => {
    if (!masterPassword.trim() || !googleUser || !storedHiveUser) return;
    setError(null);
    setLoadingAction('signin');
    try {
      let decryptedKey = '';
      try {
        const bytes = CryptoJS.AES.decrypt(storedHiveUser.encryptedPostingKey, masterPassword.trim());
        decryptedKey = bytes.toString(CryptoJS.enc.Utf8);
      } catch (e) {
        throw new Error('Incorrect master password or decryption failed.');
      }

      if (!decryptedKey) {
        throw new Error('Incorrect master password or decryption failed.');
      }

      let postingKeyObj: dhive.PrivateKey;
      try {
        postingKeyObj = dhive.PrivateKey.fromString(decryptedKey);
      } catch (e) {
        throw new Error('Decrypted key is not a valid private key.');
      }

      const derivedPublic = postingKeyObj.createPublic().toString();
      if (derivedPublic !== storedHiveUser.publicKey) {
        throw new Error('Incorrect master password.');
      }

      if (aioha) {
        const plaintextProvider = new PlaintextKeyProvider(decryptedKey);
        aioha.registerCustomProvider(plaintextProvider);
        const timestamp = new Date().toISOString();
        const loginRes = await aioha.login(Providers.Custom, storedHiveUser.hiveUsername, {
          msg: timestamp,
          keyType: KeyTypes.Posting
        });
        if (!loginRes.success) {
          throw new Error(loginRes.error || 'Failed to login with Aioha');
        }
      }

      const enrichedResult: Web2AuthResult = {
        ...googleUser,
        hiveUsername: storedHiveUser.hiveUsername,
        privatePostingKey: decryptedKey,
      };

      await handleWeb2Auth(enrichedResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Decryption failed';
      setError(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLinkSubmit = async () => {
    if (!enteredHiveUsername.trim() || !enteredPostingKey.trim() || !enteredMasterPassword.trim() || !googleUser) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    setLoadingAction('signup');
    try {
      const hiveUsername = enteredHiveUsername.trim().toLowerCase();
      const postingKeyInput = enteredPostingKey.trim();
      const masterPasswordInput = enteredMasterPassword.trim();

      let postingKeyObj: dhive.PrivateKey;
      let resolvedPostingKey: string;
      try {
        postingKeyObj = dhive.PrivateKey.fromString(postingKeyInput);
        resolvedPostingKey = postingKeyInput;
      } catch {
        postingKeyObj = dhive.PrivateKey.fromLogin(hiveUsername, postingKeyInput, 'posting');
        resolvedPostingKey = postingKeyObj.toString();
      }

      const postingPublicKey = postingKeyObj.createPublic().toString();

      const dhiveClient = new dhive.Client([getHiveAuthApiNode()]);
      const accounts = await dhiveClient.database.getAccounts([hiveUsername]);
      if (accounts.length === 0) {
        throw new Error(`Hive account @${hiveUsername} not found.`);
      }

      const postingKeys = accounts[0].posting.key_auths.map((item: any) => item[0]);
      if (!postingKeys.includes(postingPublicKey)) {
        throw new Error("Posting key does not match the Hive account.");
      }

      if (aioha) {
        const plaintextProvider = new PlaintextKeyProvider(resolvedPostingKey);
        aioha.registerCustomProvider(plaintextProvider);
        const timestamp = new Date().toISOString();
        const loginRes = await aioha.login(Providers.Custom, hiveUsername, {
          msg: timestamp,
          keyType: KeyTypes.Posting
        });
        if (!loginRes.success) {
          throw new Error(loginRes.error || 'Failed to login with Aioha');
        }
      }

      const encryptedKey = CryptoJS.AES.encrypt(resolvedPostingKey, masterPasswordInput).toString();

      const app = getFirebaseApp(web2Config);
      const db = getFirestore(app);
      const docRef = doc(db, 'google_hive_users', googleUser.uid);
      await setDoc(docRef, {
        hiveUsername,
        encryptedPostingKey: encryptedKey,
        publicKey: postingPublicKey,
        createdAt: new Date().toISOString(),
      });

      const enrichedResult: Web2AuthResult = {
        ...googleUser,
        hiveUsername,
        privatePostingKey: resolvedPostingKey,
      };

      await handleWeb2Auth(enrichedResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Linking failed';
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
        {(onBack || web2Step !== 'initial' || showEmailForm) ? (
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={() => {
              if (web2Step !== 'initial') {
                setWeb2Step('initial');
                setStoredHiveUser(null);
                setGoogleUser(null);
                setError(null);
              } else if (showEmailForm) {
                setShowEmailForm(false);
                setError(null);
              } else {
                onBack?.();
              }
            }}
          >
            ←
          </button>
        ) : (
          <div className="w-8 h-8" />
        )}

        <h3
          className="font-bold text-lg flex-1 text-center"
          style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}
        >
          {web2Step === 'decrypt'
            ? 'Decrypt Key'
            : web2Step === 'link'
            ? 'Link Hive Account'
            : showEmailForm
            ? 'Email Login'
            : 'Web2 Login'}
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

      {web2Step === 'decrypt' ? (
        <div className="flex flex-col gap-4 mt-4">
          <p className="text-sm text-gray-500 text-center">
            Enter your master password to decrypt the posting key for <strong>@{storedHiveUser?.hiveUsername}</strong>
          </p>
          
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Master Password</span>
            </label>
            <input
              type="password"
              placeholder="Enter your master password"
              className={`input input-bordered w-full ${
                theme === 'dark' ? 'bg-gray-800 text-white border-gray-600' : 'bg-gray-100 text-black border-gray-300'
              }`}
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && masterPassword.trim() && !loadingAction) {
                  handleDecryptSubmit();
                }
              }}
              disabled={!!loadingAction}
            />
          </div>

          <button
            className={`btn w-full ${
              hasCustomLoginColors
                ? `border-none focus:outline-none focus:ring-0 ${theme === 'dark' ? 'text-white' : 'text-black'}`
                : theme === 'dark' ? 'bg-primary text-white hover:bg-primary-focus border-none' : 'bg-blue-500 text-white hover:bg-blue-600 border-none'
            }`}
            style={loginButtonStyle}
            onClick={handleDecryptSubmit}
            disabled={!!loadingAction || !masterPassword.trim()}
          >
            {loadingAction === 'signin' ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <span style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}>
                Decrypt & Sign In
              </span>
            )}
          </button>
        </div>
      ) : web2Step === 'link' ? (
        <div className="flex flex-col gap-4 mt-4">
          <p className="text-sm text-gray-500 text-center">
            Link your Hive account to your Google account. We will encrypt your posting key and store it securely in Firestore.
          </p>

          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Hive Username</span>
            </label>
            <input
              type="text"
              placeholder="Enter Hive username"
              className={`input input-bordered w-full ${
                theme === 'dark' ? 'bg-gray-800 text-white border-gray-600' : 'bg-gray-100 text-black border-gray-300'
              }`}
              value={enteredHiveUsername}
              onChange={(e) => setEnteredHiveUsername(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
              disabled={!!loadingAction}
            />
          </div>

          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Posting Key (or Master Password)</span>
            </label>
            <input
              type="password"
              placeholder="Enter Private Posting Key"
              className={`input input-bordered w-full ${
                theme === 'dark' ? 'bg-gray-800 text-white border-gray-600' : 'bg-gray-100 text-black border-gray-300'
              }`}
              value={enteredPostingKey}
              onChange={(e) => setEnteredPostingKey(e.target.value)}
              disabled={!!loadingAction}
            />
          </div>

          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Create Master Password</span>
            </label>
            <input
              type="password"
              placeholder="Create master password to encrypt your key"
              className={`input input-bordered w-full ${
                theme === 'dark' ? 'bg-gray-800 text-white border-gray-600' : 'bg-gray-100 text-black border-gray-300'
              }`}
              value={enteredMasterPassword}
              onChange={(e) => setEnteredMasterPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && enteredHiveUsername.trim() && enteredPostingKey.trim() && enteredMasterPassword.trim() && !loadingAction) {
                  handleLinkSubmit();
                }
              }}
              disabled={!!loadingAction}
            />
          </div>

          <button
            className={`btn w-full ${
              hasCustomLoginColors
                ? `border-none focus:outline-none focus:ring-0 ${theme === 'dark' ? 'text-white' : 'text-black'}`
                : theme === 'dark' ? 'bg-primary text-white hover:bg-primary-focus border-none' : 'bg-blue-500 text-white hover:bg-blue-600 border-none'
            }`}
            style={loginButtonStyle}
            onClick={handleLinkSubmit}
            disabled={!!loadingAction || !enteredHiveUsername.trim() || !enteredPostingKey.trim() || !enteredMasterPassword.trim()}
          >
            {loadingAction === 'signup' ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <span style={loginButtonTextColor ? { color: loginButtonTextColor } : undefined}>
                Link & Sign In
              </span>
            )}
          </button>
        </div>
      ) : !showEmailForm ? (
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
                <span className="font-semibold whitespace-nowrap pr-2">{humanChallenge.question} =</span>
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
              style={
                (!!loadingAction || !email.trim() || !password.trim() || !humanAnswer.trim())
                  ? { ...loginButtonStyle, opacity: 0.5, cursor: 'not-allowed' }
                  : loginButtonStyle
              }
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
        <div className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-500/50 text-red-200 text-xs flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4 mt-0.5 text-red-400" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1 break-words text-left">{error}</span>
        </div>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div
      className="modal modal-open bg-black/50 cursor-pointer"
      onClick={onClose}
    >
      <div
        className={`modal-box absolute px-8 pt-8 pb-10 cursor-default ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-white'
        }`}
        style={{ width: "384px", maxWidth: "90vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};

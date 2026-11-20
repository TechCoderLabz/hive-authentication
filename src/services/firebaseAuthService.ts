/* eslint-disable @typescript-eslint/no-explicit-any */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type Auth,
  type AuthCredential,
  type UserCredential,
} from 'firebase/auth';
import type { Web2Config, Web2AuthResult, Web2NativeProvider, Web2NativeCredential } from '../types/auth';
import { DEFAULT_WEB2_SIGN_IN_TIMEOUT_MS, withWeb2SignInGuard, web2ResultFromNativeSession } from '../utils/web2SignIn';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

const WEB2_APP_NAME = 'web2AuthApp';

/** Firebase options only (drop hooks like `nativeSignIn` that Firebase must not see). */
function firebaseOptions(config: Web2Config) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { nativeSignIn, signInTimeoutMs, ...options } = config;
  return options;
}

function getFirebaseApp(config: Web2Config): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  const existingApps = getApps();
  const found = existingApps.find(
    (app) => app.name === WEB2_APP_NAME || app.options.projectId === config.projectId
  );
  if (found) {
    firebaseApp = found;
  } else {
    try {
      firebaseApp = initializeApp(firebaseOptions(config), WEB2_APP_NAME);
    } catch {
      firebaseApp = initializeApp(firebaseOptions(config));
    }
  }
  return firebaseApp;
}

function getFirebaseAuth(config: Web2Config): Auth {
  const app = getFirebaseApp(config);
  if (firebaseAuth && firebaseAuth.app === app) return firebaseAuth;
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}

function unauthorizedDomainError(err: any, suffix: string): Error | null {
  if (err?.code === 'auth/unauthorized-domain' || (typeof err?.message === 'string' && err.message.toLowerCase().includes('authorized'))) {
    return new Error(
      `Domain (${window.location.hostname}) is not authorized in Firebase Console. Please add ${window.location.hostname} to Authentication > Settings > Authorized domains in Firebase Console${suffix}.`
    );
  }
  return null;
}

/**
 * Native path, credential variant: sign the web SDK in with the provider
 * tokens the host app returned. (When the host returns a `firebaseSession`
 * instead, `providerSignIn` uses it directly and never reaches this.)
 */
async function nativeCredentialSignIn(auth: Auth, provider: Web2NativeProvider, native: Web2NativeCredential): Promise<UserCredential> {
  if (!native?.idToken && !native?.accessToken) {
    throw new Error(`${provider === 'apple' ? 'Apple' : 'Google'} sign-in did not return a token. Please try again.`);
  }
  let credential: AuthCredential;
  if (provider === 'google') {
    credential = GoogleAuthProvider.credential(native.idToken ?? null, native.accessToken ?? null);
  } else {
    credential = new OAuthProvider('apple.com').credential({
      idToken: native.idToken,
      rawNonce: native.rawNonce,
    });
  }
  return signInWithCredential(auth, credential);
}

function popupProvider(provider: Web2NativeProvider) {
  if (provider === 'google') {
    const google = new GoogleAuthProvider();
    google.setCustomParameters({ prompt: 'select_account' });
    return google;
  }
  const apple = new OAuthProvider('apple.com');
  apple.addScope('email');
  apple.addScope('name');
  return apple;
}

function resultFromCredential(provider: Web2NativeProvider, cred: UserCredential, idToken: string): Web2AuthResult {
  return {
    provider,
    uid: cred.user.uid,
    email: cred.user.email,
    displayName: cred.user.displayName,
    photoURL: cred.user.photoURL,
    idToken,
  };
}

async function providerSignIn(config: Web2Config, provider: Web2NativeProvider): Promise<Web2AuthResult> {
  const timeoutMs = config.signInTimeoutMs ?? DEFAULT_WEB2_SIGN_IN_TIMEOUT_MS;
  try {
    return await withWeb2SignInGuard(async () => {
      if (config.nativeSignIn) {
        const native = await config.nativeSignIn(provider);
        // Host signed in with the native Firebase SDK: use its ID token as-is.
        // No Firebase web SDK request is made, so a referrer-restricted web
        // API key cannot reject it from capacitor://localhost.
        const fromSession = web2ResultFromNativeSession(provider, native);
        if (fromSession) return fromSession;
        const cred = await nativeCredentialSignIn(getFirebaseAuth(config), provider, native);
        return resultFromCredential(provider, cred, await cred.user.getIdToken());
      }
      const cred = await signInWithPopup(getFirebaseAuth(config), popupProvider(provider));
      return resultFromCredential(provider, cred, await cred.user.getIdToken());
    }, timeoutMs);
  } catch (err: any) {
    if (!config.nativeSignIn) {
      const domainErr = unauthorizedDomainError(err, provider === 'google' ? ', or use Email Login' : '');
      if (domainErr) throw domainErr;
    }
    throw err;
  }
}

export const FirebaseAuthService = {
  async loginWithGoogle(config: Web2Config): Promise<Web2AuthResult> {
    return providerSignIn(config, 'google');
  },

  async loginWithApple(config: Web2Config): Promise<Web2AuthResult> {
    return providerSignIn(config, 'apple');
  },

  async signInWithEmail(config: Web2Config, email: string, password: string): Promise<Web2AuthResult> {
    const auth = getFirebaseAuth(config);
    const result = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await result.user.getIdToken();
    return {
      provider: 'email',
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      idToken,
    };
  },

  async signUpWithEmail(config: Web2Config, email: string, password: string): Promise<Web2AuthResult> {
    const auth = getFirebaseAuth(config);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await result.user.getIdToken();
    return {
      provider: 'email',
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      idToken,
    };
  },
};

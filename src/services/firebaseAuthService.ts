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
import type { Web2Config, Web2AuthResult, Web2NativeProvider } from '../types/auth';
import { DEFAULT_WEB2_SIGN_IN_TIMEOUT_MS, withWeb2SignInGuard } from '../utils/web2SignIn';

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

/** Native path: get provider tokens from the host app, then sign the web SDK in with them. */
async function nativeCredentialSignIn(config: Web2Config, auth: Auth, provider: Web2NativeProvider): Promise<UserCredential> {
  const native = await config.nativeSignIn!(provider);
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

async function providerSignIn(config: Web2Config, provider: Web2NativeProvider): Promise<Web2AuthResult> {
  const auth = getFirebaseAuth(config);
  const timeoutMs = config.signInTimeoutMs ?? DEFAULT_WEB2_SIGN_IN_TIMEOUT_MS;
  try {
    const result = await withWeb2SignInGuard(async () => {
      const cred = config.nativeSignIn
        ? await nativeCredentialSignIn(config, auth, provider)
        : await signInWithPopup(auth, popupProvider(provider));
      const idToken = await cred.user.getIdToken();
      return { cred, idToken };
    }, timeoutMs);
    return {
      provider,
      uid: result.cred.user.uid,
      email: result.cred.user.email,
      displayName: result.cred.user.displayName,
      photoURL: result.cred.user.photoURL,
      idToken: result.idToken,
    };
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

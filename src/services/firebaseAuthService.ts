/* eslint-disable @typescript-eslint/no-explicit-any */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import type { Web2Config, Web2AuthResult } from '../types/auth';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

const WEB2_APP_NAME = 'web2AuthApp';

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
      firebaseApp = initializeApp(config, WEB2_APP_NAME);
    } catch {
      firebaseApp = initializeApp(config);
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

export const FirebaseAuthService = {
  async loginWithGoogle(config: Web2Config): Promise<Web2AuthResult> {
    const auth = getFirebaseAuth(config);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      return {
        provider: 'google',
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        idToken,
      };
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain' || (typeof err?.message === 'string' && err.message.toLowerCase().includes('authorized'))) {
        throw new Error(
          `Domain (${window.location.hostname}) is not authorized in Firebase Console. Please add ${window.location.hostname} to Authentication > Settings > Authorized domains in Firebase Console, or use Email Login.`
        );
      }
      throw err;
    }
  },

  async loginWithApple(config: Web2Config): Promise<Web2AuthResult> {
    const auth = getFirebaseAuth(config);
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      return {
        provider: 'apple',
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        idToken,
      };
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain' || (typeof err?.message === 'string' && err.message.toLowerCase().includes('authorized'))) {
        throw new Error(
          `Domain (${window.location.hostname}) is not authorized in Firebase Console. Please add ${window.location.hostname} to Authentication > Settings > Authorized domains in Firebase Console.`
        );
      }
      throw err;
    }
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

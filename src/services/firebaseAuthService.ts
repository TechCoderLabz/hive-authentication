import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import type { Web2Config, Web2AuthResult } from '../types/auth';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

function getFirebaseApp(config: Web2Config): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = getApp();
  } else {
    firebaseApp = initializeApp(config);
  }
  return firebaseApp;
}

function getFirebaseAuth(config: Web2Config): Auth {
  if (firebaseAuth) return firebaseAuth;
  const app = getFirebaseApp(config);
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}

export const FirebaseAuthService = {
  async loginWithGoogle(config: Web2Config): Promise<Web2AuthResult> {
    const auth = getFirebaseAuth(config);
    const provider = new GoogleAuthProvider();
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

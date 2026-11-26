// Google / Apple sign-in without a static dependency on the Firebase web SDK.
//
// `firebaseAuthService.ts` imports `firebase/app` + `firebase/auth` (~100 KB
// gzip). Importing it statically from the login dialog put that code in every
// host app's first download, even for people who never use Google/Apple. This
// module loads it on demand instead:
//
// - Web: the dialog prefetches the module when the Google/Apple view opens
//   (`loadFirebaseAuthModule()`), so by the time a button is clicked it is
//   cached and `signInWithPopup` still runs synchronously inside the click
//   (browsers block popups opened after an `await`). If it is not cached yet,
//   it is awaited first.
// - Native (host passes `nativeSignIn`): a returned `firebaseSession` is used
//   as-is and the Firebase web SDK is never loaded. Only the legacy
//   provider-credential fallback loads it.
import type { Web2AuthResult, Web2Config, Web2NativeProvider } from '../types/auth';
import { DEFAULT_WEB2_SIGN_IN_TIMEOUT_MS, web2ResultFromNativeSession, withWeb2SignInGuard } from '../utils/web2SignIn';

type FirebaseAuthModule = typeof import('./firebaseAuthService');

let cachedModule: FirebaseAuthModule | null = null;
let pendingModule: Promise<FirebaseAuthModule> | null = null;

/** Start (or reuse) the download of the Firebase web sign-in code. */
export function loadFirebaseAuthModule(): Promise<FirebaseAuthModule> {
  if (cachedModule) return Promise.resolve(cachedModule);
  if (!pendingModule) {
    pendingModule = import('./firebaseAuthService').then(
      (m) => {
        cachedModule = m;
        return m;
      },
      (err) => {
        pendingModule = null; // allow a retry (e.g. after a deploy or offline blip)
        throw err;
      }
    );
  }
  return pendingModule;
}

/** True once the Firebase web sign-in code has been downloaded (used by tests). */
export function isFirebaseAuthModuleLoaded(): boolean {
  return cachedModule !== null;
}

/** Fire-and-forget prefetch; errors surface later when the user actually signs in. */
export function prefetchFirebaseAuthModule(): void {
  loadFirebaseAuthModule().catch(() => {});
}

/** Sign in with Google or Apple (same result and errors as `FirebaseAuthService`). */
export async function loginWithWeb2Provider(config: Web2Config, provider: Web2NativeProvider): Promise<Web2AuthResult> {
  if (config.nativeSignIn) {
    const nativeSignIn = config.nativeSignIn;
    return withWeb2SignInGuard(async () => {
      const native = await nativeSignIn(provider);
      const fromSession = web2ResultFromNativeSession(provider, native);
      if (fromSession) return fromSession;
      const m = await loadFirebaseAuthModule();
      return m.signInWithNativeCredential(config, provider, native);
    }, config.signInTimeoutMs ?? DEFAULT_WEB2_SIGN_IN_TIMEOUT_MS);
  }
  // `??` only awaits when the module is not cached yet, so with a prefetched
  // module the popup opens synchronously inside the click handler.
  const m = cachedModule ?? (await loadFirebaseAuthModule());
  return provider === 'google'
    ? m.FirebaseAuthService.loginWithGoogle(config)
    : m.FirebaseAuthService.loginWithApple(config);
}

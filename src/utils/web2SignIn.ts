/* eslint-disable @typescript-eslint/no-explicit-any */
// Helpers that keep Google / Apple sign-in from hanging forever.
//
// Inside a native WebView (Capacitor iOS/Android) the Firebase web popup can
// never complete, so the promise never settled and the login button spun
// forever. Every provider step is now raced against a timeout, and user
// cancellations are reported as a short, friendly message instead of a raw
// Firebase error.

export const DEFAULT_WEB2_SIGN_IN_TIMEOUT_MS = 60_000;

export const WEB2_CANCELLED_MESSAGE = 'Sign-in was cancelled.';
export const WEB2_TIMEOUT_MESSAGE = 'Sign-in was cancelled or timed out. Please try again.';

/** Thrown when the user closed the popup / native sheet or the sign-in timed out. */
export class Web2SignInCancelledError extends Error {
  readonly reason: 'cancelled' | 'timeout';
  constructor(reason: 'cancelled' | 'timeout') {
    super(reason === 'timeout' ? WEB2_TIMEOUT_MESSAGE : WEB2_CANCELLED_MESSAGE);
    this.name = 'Web2SignInCancelledError';
    this.reason = reason;
  }
}

const CANCEL_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
  // Capacitor / native plugin cancellations
  'canceled',
  'cancelled',
  '1001', // ASAuthorizationError.canceled
  '12501', // Google Sign-In SIGN_IN_CANCELLED (Android)
]);

/** True when an error from Firebase or a native sign-in plugin means "the user cancelled". */
export function isWeb2CancelError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Web2SignInCancelledError) return true;
  const e = err as any;
  const code = e?.code != null ? String(e.code).toLowerCase() : '';
  if (code && CANCEL_CODES.has(code)) return true;
  const message = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
  if (!message) return false;
  return (
    message.includes('popup-closed-by-user') ||
    message.includes('cancelled-popup-request') ||
    /\b(user )?(canceled|cancelled)\b/.test(message) ||
    message.includes('error 1001') ||
    message.includes('sign_in_cancelled')
  );
}

/**
 * Race `task` against a timeout. On timeout the returned promise rejects with
 * a `Web2SignInCancelledError('timeout')` so the caller's `finally` always runs.
 * Cancel-like errors from `task` are normalised to `Web2SignInCancelledError('cancelled')`.
 */
export async function withWeb2SignInGuard<T>(
  task: () => Promise<T>,
  timeoutMs: number = DEFAULT_WEB2_SIGN_IN_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
      timer = setTimeout(() => reject(new Web2SignInCancelledError('timeout')), timeoutMs);
    }
  });
  try {
    return await Promise.race([task(), timeout]);
  } catch (err) {
    if (err instanceof Web2SignInCancelledError) throw err;
    if (isWeb2CancelError(err)) throw new Web2SignInCancelledError('cancelled');
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

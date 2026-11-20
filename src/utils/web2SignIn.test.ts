import assert from 'node:assert/strict'
import {
  Web2SignInCancelledError,
  WEB2_CANCELLED_MESSAGE,
  WEB2_TIMEOUT_MESSAGE,
  isWeb2CancelError,
  withWeb2SignInGuard,
} from './web2SignIn.ts'

// Cancel detection
assert.equal(isWeb2CancelError({ code: 'auth/popup-closed-by-user' }), true)
assert.equal(isWeb2CancelError({ code: 'auth/cancelled-popup-request' }), true)
assert.equal(isWeb2CancelError({ message: 'The user canceled the sign-in flow.' }), true)
assert.equal(isWeb2CancelError({ message: 'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)' }), true)
assert.equal(isWeb2CancelError({ code: '12501' }), true)
assert.equal(isWeb2CancelError({ code: 'auth/network-request-failed', message: 'network error' }), false)
assert.equal(isWeb2CancelError(null), false)

// Resolves normally
assert.equal(await withWeb2SignInGuard(async () => 'ok', 1000), 'ok')

// A promise that never settles is rejected by the timeout
await assert.rejects(
  withWeb2SignInGuard(() => new Promise<string>(() => {}), 20),
  (err: unknown) => err instanceof Web2SignInCancelledError && err.reason === 'timeout' && err.message === WEB2_TIMEOUT_MESSAGE
)

// Cancel errors become a friendly cancel
await assert.rejects(
  withWeb2SignInGuard(async () => {
    throw Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), { code: 'auth/popup-closed-by-user' })
  }, 1000),
  (err: unknown) => err instanceof Web2SignInCancelledError && err.reason === 'cancelled' && err.message === WEB2_CANCELLED_MESSAGE
)

// Other errors pass through unchanged
const boom = new Error('boom')
await assert.rejects(withWeb2SignInGuard(async () => { throw boom }, 1000), (err: unknown) => err === boom)

console.log('web2SignIn tests passed')

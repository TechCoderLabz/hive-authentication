// Run: npx tsx src/services/web2ProviderSignIn.test.ts
import assert from 'node:assert/strict'
import { isFirebaseAuthModuleLoaded, loginWithWeb2Provider } from './web2ProviderSignIn.ts'
import { Web2SignInCancelledError } from '../utils/web2SignIn.ts'
import type { Web2Config } from '../types/auth.ts'

const base: Web2Config = { apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' }

// Native shell returning a Firebase session: result is passed through and the
// Firebase web SDK module is never loaded.
const result = await loginWithWeb2Provider(
  {
    ...base,
    nativeSignIn: async () => ({
      firebaseSession: { idToken: 'tok', uid: 'u1', email: 'a@b.c', displayName: 'A', photoURL: null },
    }),
  },
  'apple'
)
assert.deepEqual(result, { provider: 'apple', uid: 'u1', email: 'a@b.c', displayName: 'A', photoURL: null, idToken: 'tok' })
assert.equal(isFirebaseAuthModuleLoaded(), false)

// Native cancel becomes the friendly cancel error, still without the web SDK.
await assert.rejects(
  loginWithWeb2Provider({ ...base, nativeSignIn: async () => { throw new Error('The user canceled the sign-in flow.') } }, 'google'),
  (err: unknown) => err instanceof Web2SignInCancelledError && err.reason === 'cancelled'
)
// A hook that never settles hits the timeout.
await assert.rejects(
  loginWithWeb2Provider({ ...base, signInTimeoutMs: 20, nativeSignIn: () => new Promise(() => {}) }, 'google'),
  (err: unknown) => err instanceof Web2SignInCancelledError && err.reason === 'timeout'
)
assert.equal(isFirebaseAuthModuleLoaded(), false)

console.log('web2ProviderSignIn tests passed')

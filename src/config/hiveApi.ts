/**
 * Runtime-configurable Hive RPC endpoint used by every dhive Client
 * inside `hive-authentication`.
 *
 * Why this file exists: the package used to hard-code
 * `https://api.hive.blog` in four places (`programmaticAuth.ts`,
 * `authService.ts`, `apiService.ts`, `walletStore.ts`). When the host
 * app — HiveSuite — wanted to point reads/writes at a different node
 * (e.g. because the user picked one in Settings, or the auto-failover
 * rotated after a failure), there was no way in. Worse, Aioha's
 * `PlaintextKeyProvider` falls back to `techcoderx.com` if nobody calls
 * `setApi` on it, so the first broadcast after a private-posting-key
 * login was CORS-blocked.
 *
 * The fix: every dhive Client in the package now reads from
 * `getHiveApiNode()`. The host app calls `setHiveAuthApiNode(url)` to
 * change it at runtime; listeners registered with
 * `subscribeHiveAuthApiNode()` (the dhive Clients) update their
 * `address` field in place so live broadcasts pick up the new node
 * without reconstructing the client.
 *
 * Aioha is NOT touched here — the host app owns the Aioha instance and
 * calls `aioha.setApi(...)` directly. This module is solely about the
 * package-internal dhive Clients that don't go through Aioha (account
 * lookups, manabar fetches, history queries, etc.).
 */
const DEFAULT_HIVE_API_NODE = 'https://api.hive.blog'

let currentNode: string = DEFAULT_HIVE_API_NODE
const listeners = new Set<(url: string) => void>()

/** Read the active Hive RPC URL used inside the package. */
export function getHiveAuthApiNode(): string {
  return currentNode
}

/**
 * Change the active Hive RPC URL. Every dhive Client created via this
 * package picks up the new value on its next request (their `address`
 * is patched in place by the subscriber below). Safe to call as often
 * as the host wants — a no-op when the URL is unchanged.
 */
export function setHiveAuthApiNode(url: string | undefined | null): void {
  if (!url || typeof url !== 'string') return
  const trimmed = url.replace(/\/+$/, '')
  if (!trimmed || trimmed === currentNode) return
  currentNode = trimmed
  for (const cb of listeners) {
    try { cb(trimmed) } catch { /* ignore consumer errors */ }
  }
}

/** Subscribe to node changes — used by each in-package dhive Client to
 *  patch its `address` in place when the host swaps endpoints. */
export function subscribeHiveAuthApiNode(cb: (url: string) => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

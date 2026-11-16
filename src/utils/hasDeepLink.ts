/**
 * Same-device HiveAuth link opened from the QR code.
 *
 * Kept in step with hivesuite.app `src/lib/hiveAuthDeepLink.ts`. Aioha emits
 * `has://auth_req/` + standard base64 after HAS `auth_wait`. Keychain decodes
 * that base64 as-is, which is why a QR scan from a second device works and
 * why this function must not change the image — only the URL we navigate to.
 *
 * On iOS, `window.open` of a custom scheme does not deliver the path, and a
 * link ending in base64 `=` is dropped. The opened URL below is still the
 * same JSON (whitespace only) encoded so the alphabet is `[A-Za-z0-9]`.
 */

const HAS_DEEP_LINK_PREFIXES = ['has://auth_req/', 'has://sign_req/', 'has://challenge_req/'] as const

function encodeBase64(text: string): string {
  return btoa(text)
}

function decodeBase64(b64: string): string {
  const normalized = b64.replace(/ /g, '+')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat((4 - (normalized.length % 4)) % 4)
  return atob(normalized + pad)
}

export function iosSafeHasUrl(url: string): string {
  const prefix = HAS_DEEP_LINK_PREFIXES.find((item) => url.startsWith(item))
  if (!prefix) return url
  let raw = url.slice(prefix.length).trim()
  if (!raw) return url
  if (raw.includes('%')) {
    try {
      raw = decodeURIComponent(raw)
    } catch {
      // try the original bytes
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(decodeBase64(raw))
  } catch {
    return url
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return url
  const canonical = JSON.stringify(parsed)
  if (!canonical.startsWith('{')) return url
  const rest = canonical.slice(1)
  for (let spaces = 0; spaces < 4096; spaces++) {
    const encoded = encodeBase64('{' + ' '.repeat(spaces) + rest)
    if (/^[A-Za-z0-9]+$/.test(encoded)) return prefix + encoded
  }
  return url
}

/** iPhone, iPod, iPad, iPadOS desktop UA, or the Capacitor iOS shell. */
export function isIosHiveAuthDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  try {
    const platform = (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.()
    if (platform === 'ios') return true
  } catch {
    // Capacitor is not on this page.
  }
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1
}

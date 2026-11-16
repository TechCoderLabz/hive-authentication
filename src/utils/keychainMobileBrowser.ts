/**
 * Hive Keychain's mobile in-app browser (iOS and Android) injects the same
 * `window.hive_keychain` object as the desktop extension. HiveAuth's
 * same-device `has://` link does not complete from that webview, and
 * Keychain can sign natively there.
 *
 * Desktop browsers keep HiveAuth even when the extension is installed.
 * Ordinary mobile browsers keep HiveAuth until Keychain injects. The
 * Capacitor iOS/Android shell keeps HiveAuth: it is not Keychain's browser.
 */

export interface KeychainBrowserSnapshot {
  userAgent: string
  platform: string
  maxTouchPoints: number
  /** `Capacitor.getPlatform()`, or null when Capacitor is not on the page. */
  capacitorPlatform: string | null
  /** `Capacitor.isNativePlatform()`, or null when that method is absent. */
  capacitorNative: boolean | null
  hasHiveKeychain: boolean
}

export interface KeychainPresence {
  /** `window.hive_keychain` is present (extension or Keychain's mobile browser). */
  injected: boolean
  /** Injected Keychain inside a phone/tablet browser that is not the native app. */
  mobileInAppBrowser: boolean
}

export function isNativeAppShell(snapshot: Pick<KeychainBrowserSnapshot, 'capacitorPlatform' | 'capacitorNative'>): boolean {
  if (snapshot.capacitorNative === true) return true
  const platform = (snapshot.capacitorPlatform || '').toLowerCase()
  return platform === 'ios' || platform === 'android'
}

export function isMobileBrowserDevice(
  snapshot: Pick<KeychainBrowserSnapshot, 'userAgent' | 'platform' | 'maxTouchPoints'>,
): boolean {
  const ua = snapshot.userAgent || ''
  if (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return true
  // iPadOS 13+ reports a desktop Macintosh user agent.
  return snapshot.platform === 'MacIntel' && (snapshot.maxTouchPoints || 0) > 1
}

export function classifyKeychainBrowser(snapshot: KeychainBrowserSnapshot): KeychainPresence {
  const injected = snapshot.hasHiveKeychain === true
  const mobileInAppBrowser =
    injected && isMobileBrowserDevice(snapshot) && !isNativeAppShell(snapshot)
  return { injected, mobileInAppBrowser }
}

/**
 * `hiveAuthVisible` on the login dialog.
 * `true` forces HiveAuth on, `false` forces it off, `undefined` follows detection.
 */
export function shouldHideHiveAuth(presence: KeychainPresence, hiveAuthVisible?: boolean): boolean {
  if (hiveAuthVisible === false) return true
  if (hiveAuthVisible === true) return false
  return presence.mobileInAppBrowser
}

function readCapacitor(): { platform: string | null; native: boolean | null } {
  if (typeof globalThis === 'undefined') return { platform: null, native: null }
  const cap = (globalThis as {
    Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean }
  }).Capacitor
  if (!cap) return { platform: null, native: null }
  try {
    return {
      platform: typeof cap.getPlatform === 'function' ? cap.getPlatform() : null,
      native: typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : null,
    }
  } catch {
    return { platform: null, native: null }
  }
}

export function readKeychainPresence(): KeychainPresence {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { injected: false, mobileInAppBrowser: false }
  }
  const capacitor = readCapacitor()
  const keychain = (window as Window & { hive_keychain?: unknown }).hive_keychain
  return classifyKeychainBrowser({
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
    capacitorPlatform: capacitor.platform,
    capacitorNative: capacitor.native,
    hasHiveKeychain: keychain != null,
  })
}

/** True when HiveAuth login should be hidden on this page right now. */
export function isKeychainMobileInAppBrowser(): boolean {
  return readKeychainPresence().mobileInAppBrowser
}

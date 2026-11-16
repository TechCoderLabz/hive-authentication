import assert from 'node:assert/strict'
import { classifyKeychainBrowser, shouldHideHiveAuth } from './keychainMobileBrowser.ts'

const desktop = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  platform: 'MacIntel',
  maxTouchPoints: 0,
  capacitorPlatform: null,
  capacitorNative: null,
}

const android = {
  userAgent:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  maxTouchPoints: 5,
  capacitorPlatform: 'web' as string | null,
  capacitorNative: false as boolean | null,
}

const iphone = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  platform: 'iPhone',
  maxTouchPoints: 5,
  capacitorPlatform: 'web' as string | null,
  capacitorNative: false as boolean | null,
}

const ipadDesktopUa = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
  capacitorPlatform: null,
  capacitorNative: null,
}

function presence(extra: Record<string, unknown>) {
  return classifyKeychainBrowser({ ...desktop, hasHiveKeychain: false, ...extra })
}

const desktopExtension = presence({ hasHiveKeychain: true })
assert.equal(desktopExtension.injected, true)
assert.equal(desktopExtension.mobileInAppBrowser, false)
assert.equal(shouldHideHiveAuth(desktopExtension), false)

const androidKeychain = presence({ ...android, hasHiveKeychain: true })
assert.equal(androidKeychain.mobileInAppBrowser, true)
assert.equal(shouldHideHiveAuth(androidKeychain), true)

const iphoneKeychain = presence({ ...iphone, hasHiveKeychain: true })
assert.equal(iphoneKeychain.mobileInAppBrowser, true)

const ipadKeychain = presence({ ...ipadDesktopUa, hasHiveKeychain: true })
assert.equal(ipadKeychain.mobileInAppBrowser, true)

const mobileSafari = presence({ ...iphone, hasHiveKeychain: false })
assert.equal(mobileSafari.injected, false)
assert.equal(mobileSafari.mobileInAppBrowser, false)
assert.equal(shouldHideHiveAuth(mobileSafari), false)

const nativeIos = presence({
  ...iphone,
  hasHiveKeychain: true,
  capacitorPlatform: 'ios',
  capacitorNative: true,
})
assert.equal(nativeIos.injected, true)
assert.equal(nativeIos.mobileInAppBrowser, false)
assert.equal(shouldHideHiveAuth(nativeIos), false)

const nativeAndroid = presence({
  ...android,
  hasHiveKeychain: false,
  capacitorPlatform: 'android',
  capacitorNative: true,
})
assert.equal(nativeAndroid.mobileInAppBrowser, false)

assert.equal(shouldHideHiveAuth(androidKeychain, true), false)
assert.equal(shouldHideHiveAuth(desktopExtension, false), true)

console.log('keychainMobileBrowser tests passed')

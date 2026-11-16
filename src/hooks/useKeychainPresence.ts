import { useEffect, useState } from 'react'
import { readKeychainPresence, type KeychainPresence } from '../utils/keychainMobileBrowser'

const POLL_MS = 200
/** Keychain's content script can land after the first paint. Keep looking briefly. */
const POLL_BUDGET_MS = 12_000

/**
 * `window.hive_keychain` is often injected a moment after page load
 * (extension `document_idle`, or the mobile webview bridge). Poll until it
 * appears. Pass `active` (the dialog's `isOpen`) so opening the dialog
 * probes immediately and keeps watching while it stays open.
 */
export function useKeychainPresence(active = false): KeychainPresence {
  const [presence, setPresence] = useState<KeychainPresence>(readKeychainPresence)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    const apply = (): boolean => {
      if (cancelled) return true
      const next = readKeychainPresence()
      setPresence((prev) =>
        prev.injected === next.injected && prev.mobileInAppBrowser === next.mobileInAppBrowser
          ? prev
          : next,
      )
      return next.injected
    }

    if (apply()) return

    const onReady = () => {
      apply()
    }
    window.addEventListener('hive_keychain_ready', onReady)
    const interval = window.setInterval(() => {
      if (apply()) window.clearInterval(interval)
    }, POLL_MS)
    // A closed dialog only needs the post-load window. An open dialog keeps
    // watching so a late injection still hides HiveAuth before the user taps it.
    const budget = active
      ? undefined
      : window.setTimeout(() => window.clearInterval(interval), POLL_BUDGET_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      if (budget !== undefined) window.clearTimeout(budget)
      window.removeEventListener('hive_keychain_ready', onReady)
    }
  }, [active])

  return presence
}

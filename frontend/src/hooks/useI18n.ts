import { useCallback, useSyncExternalStore } from 'react'
import { t, getLocale, setLocale, type TranslationKey } from '../i18n'

let listeners: Array<() => void> = []

function subscribe(listener: () => void) {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot() {
  return getLocale()
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getSnapshot)

  const changeLocale = useCallback((newLocale: 'ko' | 'en') => {
    setLocale(newLocale)
    listeners.forEach((l) => l())
  }, [])

  const translate = useCallback(
    (key: TranslationKey) => t(key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  )

  return { locale, t: translate, changeLocale }
}

'use client'

const EMPTY_NOTIFICATIONS = '[]'

export function resetAllDevelopmentData() {
  if (typeof window === 'undefined') return

  window.localStorage.clear()
  window.sessionStorage.clear()

  window.localStorage.setItem('vvveco-notifications', EMPTY_NOTIFICATIONS)
  window.localStorage.removeItem('vvveco-uid-counter')
  window.dispatchEvent(new CustomEvent('vvveco-notifications-change'))
  window.dispatchEvent(new CustomEvent('vvveco-global-stats-change'))
  window.dispatchEvent(new CustomEvent('vvveco-dev-data-reset'))
}

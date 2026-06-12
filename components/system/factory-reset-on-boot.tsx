'use client'

import { useEffect } from 'react'

const FACTORY_RESET_VERSION = 'vvveco-factory-reset-2026-05-31-zero-wallet-balance'

export function FactoryResetOnBoot() {
  useEffect(() => {
    if (window.localStorage.getItem(FACTORY_RESET_VERSION) === 'done') {
      return
    }

    window.localStorage.clear()
    window.sessionStorage.clear()
    window.localStorage.setItem('vvveco-notifications', '[]')
    window.localStorage.setItem(FACTORY_RESET_VERSION, 'done')
    window.dispatchEvent(new CustomEvent('vvveco-notifications-change'))
    window.dispatchEvent(new CustomEvent('vvveco-local-web3-sim-change'))
    window.dispatchEvent(new CustomEvent('vvveco-dev-data-reset'))
    void fetch('/admin/logout', {
      method: 'GET',
      credentials: 'include',
      redirect: 'manual',
    })
  }, [])

  return null
}

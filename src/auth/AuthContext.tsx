import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getUser, type ClientPrincipal } from './client'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
  user: ClientPrincipal | null
}

// Stub identity used only when /.auth/me is unavailable (plain `vite dev`),
// so the dashboard remains usable while iterating on the UI offline.
const DEV_USER: ClientPrincipal = {
  identityProvider: 'dev',
  userId: 'dev',
  userDetails: 'Dev User',
  userRoles: ['anonymous', 'authenticated'],
}

const AuthContext = createContext<AuthState>({ status: 'loading', user: null })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })

  useEffect(() => {
    let active = true
    getUser().then((result) => {
      if (!active) return
      switch (result.kind) {
        case 'authenticated':
          setState({ status: 'authenticated', user: result.user })
          break
        case 'anonymous':
          setState({ status: 'anonymous', user: null })
          break
        case 'unavailable':
          // No SWA auth runtime (plain vite dev) — fall back to the dev stub.
          setState({ status: 'authenticated', user: DEV_USER })
          break
      }
    })
    return () => {
      active = false
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(AuthContext)
}

import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import type { ClientPrincipal } from './auth/client'

function mockAuthMe(principal: ClientPrincipal | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/.auth/me')) {
        return new Response(JSON.stringify({ clientPrincipal: principal }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      // Any data API call (weather/news/...) fails so the UI uses mock fallback.
      return new Response('not found', { status: 404 })
    }),
  )
}

const AUTHED: ClientPrincipal = {
  identityProvider: 'apple',
  userId: 'u1',
  userDetails: 'parent@example.com',
  userRoles: ['anonymous', 'authenticated'],
}

function renderApp() {
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App (authenticated)', () => {
  beforeEach(() => mockAuthMe(AUTHED))

  it('renders the family heading', async () => {
    renderApp()
    expect(await screen.findByText('Johnston family')).toBeInTheDocument()
  })

  it('renders all dashboard sections', async () => {
    renderApp()
    expect(await screen.findByText('Family calendar')).toBeInTheDocument()
    expect(screen.getByText('News')).toBeInTheDocument()
    expect(screen.getByText('Streaming')).toBeInTheDocument()
    expect(screen.getByText('Upcoming theatrical releases')).toBeInTheDocument()
  })

  it('shows a weather tile for each member location', async () => {
    renderApp()
    expect(await screen.findByText(/Austin, TX/)).toBeInTheDocument()
    expect(screen.getByText(/Denver, CO/)).toBeInTheDocument()
  })

  it('shows the signed-in user and a sign-out link', async () => {
    renderApp()
    expect(await screen.findByText('parent@example.com')).toBeInTheDocument()
    expect(screen.getByText('Sign out')).toHaveAttribute('href', '/logout')
  })
})

describe('App (anonymous)', () => {
  beforeEach(() => mockAuthMe(null))

  it('shows the login screen instead of the dashboard', async () => {
    renderApp()
    expect(await screen.findByText('Sign in with Apple')).toBeInTheDocument()
    expect(screen.queryByText('Family calendar')).not.toBeInTheDocument()
  })
})

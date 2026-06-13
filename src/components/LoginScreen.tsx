import { LOGIN_PATH } from '../auth/client'

export default function LoginScreen() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-title">Johnston family</div>
        <p className="login-subtitle">Sign in to view the family dashboard.</p>
        <button
          type="button"
          className="apple-signin"
          onClick={() => window.location.assign(LOGIN_PATH)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M11.05 8.5c.02 2.05 1.8 2.73 1.82 2.74-.01.05-.28 1-.94 1.97-.56.84-1.15 1.67-2.08 1.69-.91.02-1.2-.54-2.24-.54-1.04 0-1.36.52-2.22.55-.9.04-1.58-.9-2.15-1.74C1.07 11.45.18 8.3 1.4 6.17c.6-1.06 1.69-1.73 2.86-1.75.88-.02 1.71.6 2.25.6.54 0 1.55-.74 2.61-.63.44.02 1.69.18 2.49 1.36-.06.04-1.49.87-1.47 2.75M9.4 3.2c.48-.58.8-1.39.71-2.2-.69.03-1.53.46-2.02 1.04-.44.51-.83 1.34-.73 2.13.77.06 1.55-.39 2.04-.97" />
          </svg>
          Sign in with Apple
        </button>
      </div>
    </div>
  )
}

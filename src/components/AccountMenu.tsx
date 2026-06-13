import { displayName, LOGOUT_PATH, type ClientPrincipal } from '../auth/client'

export default function AccountMenu({ user }: { user: ClientPrincipal }) {
  return (
    <div className="account-menu">
      <span className="account-name" title={user.userDetails}>
        {displayName(user)}
      </span>
      <a className="account-logout" href={LOGOUT_PATH}>
        Sign out
      </a>
    </div>
  )
}

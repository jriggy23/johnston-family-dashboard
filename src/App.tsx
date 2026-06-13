import AccountMenu from './components/AccountMenu'
import CalendarCard from './components/CalendarCard'
import LoginScreen from './components/LoginScreen'
import NewsCard from './components/NewsCard'
import StreamingSection from './components/StreamingSection'
import TheatricalSection from './components/TheatricalSection'
import WeatherStrip from './components/WeatherStrip'
import { useAuth } from './auth/AuthContext'
import { useDashboardData } from './hooks/useDashboardData'
import { familyMembers, mockEvents } from './data/mock'
import type { ClientPrincipal } from './auth/client'

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function Dashboard({ user }: { user: ClientPrincipal }) {
  // Calendar events remain mock for now (no calendar API yet).
  const { weather, news, streaming, theatrical } = useDashboardData()

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <div className="app-title">Johnston family</div>
          <div className="app-date">{todayLabel()}</div>
        </div>
        <div className="header-right">
          <div className="avatars">
            {familyMembers.map((m) => (
              <div
                key={m.id}
                className="avatar"
                title={m.name}
                style={{ background: m.color, color: m.textColor }}
              >
                {m.initials}
              </div>
            ))}
          </div>
          <AccountMenu user={user} />
        </div>
      </header>

      <WeatherStrip members={familyMembers} weather={weather} />

      <div className="grid grid-main">
        <CalendarCard events={mockEvents} />
        <NewsCard items={news} />
      </div>

      <StreamingSection titles={streaming} />
      <TheatricalSection releases={theatrical} />
    </div>
  )
}

export default function App() {
  const { status, user } = useAuth()

  if (status === 'loading') {
    return <div className="app-loading">Loading…</div>
  }

  if (status === 'anonymous' || !user) {
    return <LoginScreen />
  }

  return <Dashboard user={user} />
}

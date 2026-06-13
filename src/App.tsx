import AccountMenu from './components/AccountMenu'
import CalendarCard from './components/CalendarCard'
import LoginScreen from './components/LoginScreen'
import NewsCard from './components/NewsCard'
import NowPlayingSection from './components/NowPlayingSection'
import StreamingSection from './components/StreamingSection'
import TheatricalSection from './components/TheatricalSection'
import WeatherCards from './components/WeatherCards'
import { useAuth } from './auth/AuthContext'
import { useDashboardData } from './hooks/useDashboardData'
import { familyMembers } from './data/mock'
import type { ClientPrincipal } from './auth/client'

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function Dashboard({ user }: { user: ClientPrincipal }) {
  const { calendar, news, theatrical } = useDashboardData()

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

      <WeatherCards />

      <div className="grid grid-main">
        <CalendarCard events={calendar} />
        <NewsCard items={news} />
      </div>

      <StreamingSection />
      <TheatricalSection releases={theatrical} />
      <NowPlayingSection />
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

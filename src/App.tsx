import AccountMenu from './components/AccountMenu'
import LoginScreen from './components/LoginScreen'
import NewsCard from './components/NewsCard'
import NowPlayingSection from './components/NowPlayingSection'
import StreamingSection from './components/StreamingSection'
import TheatricalSection from './components/TheatricalSection'
import WeatherCards from './components/WeatherCards'
import WeeklyCalendar from './components/WeeklyCalendar'
import { useAuth } from './auth/AuthContext'
import { useDashboardData } from './hooks/useDashboardData'
import { useFamilyMembers } from './hooks/useFamilyMembers'
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
  const { members, saveMember } = useFamilyMembers()

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <div className="app-title">Johnston family</div>
          <div className="app-date">{todayLabel()}</div>
        </div>
        <div className="header-right">
          <div className="avatars">
            {members.map((m) =>
              m.photo ? (
                <img
                  key={m.id}
                  className="avatar"
                  src={m.photo}
                  alt={m.name}
                  title={m.name}
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div
                  key={m.id}
                  className="avatar"
                  title={m.name}
                  style={{ background: m.color, color: m.textColor }}
                >
                  {m.initials}
                </div>
              ),
            )}
          </div>
          <AccountMenu user={user} />
        </div>
      </header>

      <WeatherCards />

      <div style={{ marginBottom: 16 }}>
        <WeeklyCalendar
          events={calendar.items}
          members={members}
          loading={calendar.loading}
          saveMember={saveMember}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <NewsCard items={news.items} loading={news.loading} />
      </div>

      <StreamingSection />
      <TheatricalSection releases={theatrical.items} loading={theatrical.loading} />
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

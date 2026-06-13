import CalendarCard from './components/CalendarCard'
import NewsCard from './components/NewsCard'
import StreamingSection from './components/StreamingSection'
import TheatricalSection from './components/TheatricalSection'
import WeatherStrip from './components/WeatherStrip'
import {
  familyMembers,
  mockEvents,
  mockNews,
  mockStreaming,
  mockTheatrical,
  mockWeather,
} from './data/mock'

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <div className="app-title">Johnston family</div>
          <div className="app-date">{todayLabel()}</div>
        </div>
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
      </header>

      <WeatherStrip members={familyMembers} weather={mockWeather} />

      <div className="grid grid-main">
        <CalendarCard events={mockEvents} />
        <NewsCard items={mockNews} />
      </div>

      <StreamingSection titles={mockStreaming} />
      <TheatricalSection releases={mockTheatrical} />
    </div>
  )
}

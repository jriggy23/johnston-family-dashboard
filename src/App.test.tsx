import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the family heading', () => {
    render(<App />)
    expect(screen.getByText('Johnston family')).toBeInTheDocument()
  })

  it('renders all dashboard sections', () => {
    render(<App />)
    expect(screen.getByText('Family calendar')).toBeInTheDocument()
    expect(screen.getByText('News')).toBeInTheDocument()
    expect(screen.getByText('Streaming')).toBeInTheDocument()
    expect(screen.getByText('Upcoming theatrical releases')).toBeInTheDocument()
  })

  it('shows a weather tile for each member location', () => {
    render(<App />)
    expect(screen.getByText(/Austin, TX/)).toBeInTheDocument()
    expect(screen.getByText(/Denver, CO/)).toBeInTheDocument()
  })
})

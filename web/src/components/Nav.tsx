import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { Button } from './Button'

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <Logo size="md" />
        <nav className="hidden items-center gap-6 text-sm text-mid md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#preview" className="hover:text-ink">Score</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <Link to="/dashboard" className="hover:text-ink">Dashboard demo</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/dashboard')}>
            Sign in
          </Button>
          <Button variant="primary" size="sm" onClick={() => (window.location.href = '/dashboard')}>
            Start free
          </Button>
        </div>
      </div>
    </header>
  )
}

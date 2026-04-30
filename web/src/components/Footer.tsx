import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <span className="kicker">AEO PLATFORM</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-mid">
          <a href="#" className="hover:text-ink">Product</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <a href="#" className="hover:text-ink">Blog</a>
          <a href="#" className="hover:text-ink">Docs</a>
          <a href="#" className="hover:text-ink">Privacy</a>
          <a href="#" className="hover:text-ink">Terms</a>
        </nav>
        <div className="font-mono text-[11px] tracking-wider text-silver">
          © 2026 CITED INC.
        </div>
      </div>
    </footer>
  )
}

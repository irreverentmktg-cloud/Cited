import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  to?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'text-[18px]',
  md: 'text-[22px]',
  lg: 'text-[28px]',
}

export function Logo({ className, to = '/', size = 'md' }: LogoProps) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-baseline font-extrabold tracking-tightest text-ink',
        sizes[size],
        className,
      )}
    >
      Cited<span className="chrome-text">.</span>
    </Link>
  )
}

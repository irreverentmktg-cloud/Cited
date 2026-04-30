import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'chrome' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
}

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-white hover:bg-rich active:bg-black border border-ink shadow-[0_1px_2px_rgba(0,0,0,0.2)]',
  chrome:
    'bg-chrome text-ink border border-line shadow-chrome hover:brightness-[1.02] active:brightness-95',
  ghost:
    'bg-transparent text-ink border border-line hover:border-ink hover:bg-white',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

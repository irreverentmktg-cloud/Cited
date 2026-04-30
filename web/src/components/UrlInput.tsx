import { ArrowRight, Globe } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

interface UrlInputProps {
  initialUrl?: string
}

export function UrlInput({ initialUrl = '' }: UrlInputProps) {
  const [url, setUrl] = useState(initialUrl)
  const navigate = useNavigate()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = url.trim() || 'bloom-collagen.com'
    const params = new URLSearchParams({ url: value })
    navigate(`/analyzing?${params.toString()}`)
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[640px]">
      <div className="card flex items-center gap-2 p-2 pl-4">
        <Globe size={18} className="shrink-0 text-silver" />
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter your website URL — e.g. yourbrand.com"
          className="h-12 w-full bg-transparent text-[15px] text-ink placeholder:text-silver focus:outline-none"
          aria-label="Website URL"
        />
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-rich"
        >
          Analyze My Brand
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="mt-3 text-center font-mono text-[11px] tracking-wider text-silver">
        FREE · NO CREDIT CARD · RESULTS IN 30 SECONDS
      </div>
    </form>
  )
}

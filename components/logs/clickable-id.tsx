"use client"

import { useState, useCallback } from 'react'
import Copy2 from '@/components/icons/copy-2'
import Check2 from '@/components/icons/check-2'

interface ClickableIdProps {
  id: string
  preview?: boolean
}

export function ClickableId({ id, preview = false }: ClickableIdProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // no-op fallback
    }
  }, [id])

  const displayId = preview && id.length > 24 
    ? `${id.substring(0, 12)}...${id.substring(id.length - 12)}`
    : id

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 w-full text-left text-sm font-mono text-foreground hover:text-foreground/80 transition-colors group cursor-pointer"
      title={copied ? "Copied!" : `Click to copy${preview ? ` (${id})` : ''}`}
    >
      <div className="shrink-0 text-muted-foreground group-hover:text-foreground/60 transition-colors">
        {copied ? (
          <Check2 width="14" height="14" />
        ) : (
          <Copy2 width="14" height="14" />
        )}
      </div>
      <span className="flex-1 break-all">{displayId}</span>
    </button>
  )
}

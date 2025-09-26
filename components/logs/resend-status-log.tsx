"use client"

import { useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import CircleCheck from '@/components/icons/circle-check'
import CircleXmark from '@/components/icons/circle-xmark'
import Clock2 from '@/components/icons/clock-2'

interface LogEntry {
  ts: Date
  text: string
  type: 'info' | 'success' | 'error'
}

interface ResendStatusLogProps {
  logs: LogEntry[]
  lastStatus?: {
    success: boolean
    message: string
    deliveryId?: string
    timestamp: Date
  }
}

export function ResendStatusLog({ logs, lastStatus }: ResendStatusLogProps) {
  const logEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  if (logs.length === 0 && !lastStatus) {
    return null
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Resend Activity</div>
      
      {/* Status Summary */}
      {lastStatus && (
        <div className="flex items-center gap-2 text-xs p-2 bg-muted/50 rounded-md">
          {lastStatus.success ? (
            <CircleCheck className="h-3 w-3 text-green-500" />
          ) : (
            <CircleXmark className="h-3 w-3 text-red-500" />
          )}
          <span className="font-medium">
            Last resend: {lastStatus.success ? 'Success' : 'Failed'}
          </span>
          <span className="text-muted-foreground">
            {lastStatus.message}
          </span>
          {lastStatus.deliveryId && (
            <Badge variant="outline" className="text-xs">
              {lastStatus.deliveryId.slice(-8)}
            </Badge>
          )}
          <Clock2 className="h-3 w-3 text-muted-foreground ml-auto" />
          <span className="text-muted-foreground">
            {lastStatus.timestamp.toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Activity Log */}
      {logs.length > 0 && (
        <div className="rounded-md border border-border bg-black/95 text-white font-mono text-xs p-3 max-h-32 overflow-auto">
          {logs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap break-words">
              <span className="text-white/40">[{log.ts.toLocaleTimeString()}]</span>{' '}
              <span className={
                log.type === 'success' ? 'text-green-400' :
                log.type === 'error' ? 'text-red-400' :
                'text-white'
              }>
                {log.text}
              </span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}

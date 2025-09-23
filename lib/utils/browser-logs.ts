"use client"

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

type LogEntry = {
  level: LogLevel | 'event'
  timestamp: number
  args: unknown[]
}

const MAX_ENTRIES = 200

let initialized = false
let consoleBuffer: LogEntry[] = []
let errorBuffer: LogEntry[] = []

const originalConsole: Partial<Record<LogLevel, (...args: unknown[]) => void>> = {}

function pushEntry(target: LogEntry[], entry: LogEntry) {
  target.push(entry)
  if (target.length > MAX_ENTRIES) {
    target.splice(0, target.length - MAX_ENTRIES)
  }
}

export function initBrowserLogCollector(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  // Wrap console methods
  ;(['log', 'info', 'warn', 'error', 'debug'] as LogLevel[]).forEach((level) => {
    originalConsole[level] = console[level]
    console[level] = (...args: unknown[]) => {
      try {
        pushEntry(consoleBuffer, { level, timestamp: Date.now(), args })
      } catch {}
      // call original
      try {
        originalConsole[level]?.(...args as any)
      } catch {}
    }
  })

  // Global error handlers
  window.addEventListener('error', (event) => {
    pushEntry(errorBuffer, {
      level: 'event',
      timestamp: Date.now(),
      args: [
        'error',
        event.message,
        event.filename,
        event.lineno,
        event.colno,
        (event.error && (event.error as any).stack) || null,
      ],
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    pushEntry(errorBuffer, {
      level: 'event',
      timestamp: Date.now(),
      args: ['unhandledrejection', String((event as any).reason || 'unknown')],
    })
  })
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function serializeArg(arg: unknown): string {
  if (typeof arg === 'string') return arg
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ''}`
  try {
    return JSON.stringify(arg, null, 2)
  } catch {
    return String(arg)
  }
}

export function getBrowserContextSummary(): string {
  if (typeof window === 'undefined') return 'Context unavailable (server)'
  const parts: string[] = []
  try {
    parts.push(`URL: ${window.location.href}`)
    parts.push(`User Agent: ${navigator.userAgent}`)
    parts.push(`Platform: ${navigator.platform}`)
    // @ts-expect-error non-standard but useful if available
    if (navigator.userAgentData?.platform) parts.push(`UA Platform: ${navigator.userAgentData.platform}`)
    // @ts-expect-error non-standard brands
    if (navigator.userAgentData?.brands) parts.push(`UA Brands: ${JSON.stringify(navigator.userAgentData.brands)}`)
    parts.push(`Viewport: ${window.innerWidth} x ${window.innerHeight}`)
    parts.push(`Language: ${navigator.language}`)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      parts.push(`Timezone: ${tz}`)
    } catch {}
  } catch (e) {
    parts.push(`Context error: ${String(e)}`)
  }
  return parts.join('\n')
}

export function getBrowserLogsText(): string {
  const lines: string[] = []
  lines.push('Inbound Browser Logs')
  lines.push(`Captured: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('== Context ==')
  lines.push(getBrowserContextSummary())
  lines.push('')
  lines.push('== Console (latest) ==')
  for (const entry of consoleBuffer) {
    const prefix = `[${formatDate(entry.timestamp)}] ${entry.level.toUpperCase()}`
    const body = entry.args.map(serializeArg).join(' ')
    lines.push(`${prefix}: ${body}`)
  }
  lines.push('')
  lines.push('== Errors & Rejections ==')
  for (const entry of errorBuffer) {
    const prefix = `[${formatDate(entry.timestamp)}] ${entry.args[0]}`
    const body = entry.args.slice(1).map(serializeArg).join(' ')
    lines.push(`${prefix}: ${body}`)
  }
  lines.push('')
  return lines.join('\n')
}



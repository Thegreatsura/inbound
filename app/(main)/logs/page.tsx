"use client"

import { useEffect, useState, Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
// Sheet removed in favor of dedicated details page
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { formatDistanceToNow, format } from 'date-fns'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import CircleXmark from '@/components/icons/circle-xmark'

// Import Nucleo icons
import Clock2 from '@/components/icons/clock-2'
import Database2 from '@/components/icons/database-2'
import Eye2 from '@/components/icons/eye-2'
import Filter2 from '@/components/icons/filter-2'
import Refresh2 from '@/components/icons/refresh-2'
import Magnifier2 from '@/components/icons/magnifier-2'
import CircleCross from '@/components/icons/circle-xmark'
import CircleCheck from '@/components/icons/circle-check'
import TabClose from '@/components/icons/tab-close'
import CirclePlay from '@/components/icons/circle-play'
import CircleDots from '@/components/icons/circle-dots'
import Hashtag2 from '@/components/icons/hashtag-2'
import ShieldCheck from '@/components/icons/shield-check'
import Ban2 from '@/components/icons/ban-2'
import ArrowUpRight2 from '@/components/icons/arrow-up-right-2'
import ArchiveDownload from '@/components/icons/archive-download'
import ArchiveExport from '@/components/icons/archive-export'
import EnvelopeArrowLeft from '@/components/icons/envelope-arrow-left'
import EnvelopeArrowRight from '@/components/icons/envelope-arrow-right'

import { useInfiniteUnifiedEmailLogsQuery } from '@/features/emails/hooks'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { EmailLogsOptions, EmailLogEntry, InboundEmailLogEntry, OutboundEmailLogEntry } from '@/features/emails/types'
import SidebarToggleButton from '@/components/sidebar-toggle-button'
import { Card } from '@/components/ui/card'

function getStatusColor(email: EmailLogEntry): string {
  if (email.type === 'inbound') {
    const inboundEmail = email as InboundEmailLogEntry
    const hasDeliveries = inboundEmail.deliveries.length > 0
    const hasSuccessfulDelivery = inboundEmail.deliveries.some(d => d.status === 'success')
    const hasFailedDelivery = inboundEmail.deliveries.some(d => d.status === 'failed')
    const hasPendingDelivery = inboundEmail.deliveries.some(d => d.status === 'pending')

    if (!inboundEmail.parseSuccess) {
      return '#ef4444' // red-500
    } else if (hasSuccessfulDelivery) {
      return '#22c55e' // green-500
    } else if (hasFailedDelivery) {
      return '#ef4444' // red-500
    } else if (hasPendingDelivery) {
      return '#eab308' // yellow-500
    } else if (!hasDeliveries) {
      return '#9ca3af' // gray-400
    } else {
      return '#9ca3af' // gray-400
    }
  } else {
    // Outbound email
    const outboundEmail = email as OutboundEmailLogEntry

    switch (outboundEmail.status) {
      case 'sent':
        return '#22c55e' // green-500
      case 'failed':
        return '#ef4444' // red-500
      case 'pending':
        return '#eab308' // yellow-500
      default:
        return '#9ca3af' // gray-400
    }
  }
}

function getTypeIcon(email: EmailLogEntry) {
  const statusColor = getStatusColor(email)
  
  if (email.type === 'inbound') {
    return <EnvelopeArrowLeft width="20" height="20" fill="#9333ea" secondaryfill={statusColor} />
  } else {
    return <EnvelopeArrowRight width="20" height="20" fill="#3b82f6" secondaryfill={statusColor} />
  }
}

function getStatusDot(email: EmailLogEntry) {
  if (email.type === 'inbound') {
    const inboundEmail = email as InboundEmailLogEntry
    const hasDeliveries = inboundEmail.deliveries.length > 0
    const hasSuccessfulDelivery = inboundEmail.deliveries.some(d => d.status === 'success')
    const hasFailedDelivery = inboundEmail.deliveries.some(d => d.status === 'failed')
    const hasPendingDelivery = inboundEmail.deliveries.some(d => d.status === 'pending')

    if (!inboundEmail.parseSuccess) {
      return <div className="w-2 h-2 rounded-full bg-red-500" />
    } else if (hasSuccessfulDelivery) {
      return <div className="w-2 h-2 rounded-full bg-green-500" />
    } else if (hasFailedDelivery) {
      return <div className="w-2 h-2 rounded-full bg-red-500" />
    } else if (hasPendingDelivery) {
      return <div className="w-2 h-2 rounded-full bg-yellow-500" />
    } else if (!hasDeliveries) {
      return <div className="w-2 h-2 rounded-full bg-gray-400" />
    } else {
      return <div className="w-2 h-2 rounded-full bg-gray-400" />
    }
  } else {
    // Outbound email
    const outboundEmail = email as OutboundEmailLogEntry

    switch (outboundEmail.status) {
      case 'sent':
        return <div className="w-2 h-2 rounded-full bg-green-500" />
      case 'failed':
        return <div className="w-2 h-2 rounded-full bg-red-500" />
      case 'pending':
        return <div className="w-2 h-2 rounded-full bg-yellow-500" />
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-400" />
    }
  }
}

// Loading skeleton component
function LogsPageSkeleton() {
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-5xl mx-auto px-2">
        {/* Header Skeleton */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-8 w-32" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Skeleton className="h-9 flex-1 min-w-[200px]" />
            <Skeleton className="h-9 w-[120px]" />
            <Skeleton className="h-9 w-[140px]" />
            <Skeleton className="h-9 w-[140px]" />
            <Skeleton className="h-9 w-[140px]" />
          </div>
        </div>

        {/* Stats Bar Skeleton */}
        <div className="mb-6 bg-muted/30 border border-border rounded-xl p-2">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Email List Skeleton */}
      <div className="w-full max-w-5xl mx-auto px-2">
        <div className="divide-y divide-border">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-3">
              <Skeleton className="h-4 w-4 flex-shrink-0" />
              <Skeleton className="h-4 w-20 flex-shrink-0" />
              <Skeleton className="h-4 w-48 flex-shrink-0" />
              <Skeleton className="h-4 w-48 flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24 flex-shrink-0" />
              <Skeleton className="h-4 w-16 flex-shrink-0" />
              <Skeleton className="h-3 w-3 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LogsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [domainFilter, setDomainFilter] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('7d')
  const [selectedLog, setSelectedLog] = useState<EmailLogEntry | null>(null)
  const [rotationDegrees, setRotationDegrees] = useState(0)

  // Debounce inputs to cut request volume
  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  const debouncedStatus = useDebouncedValue(statusFilter, 150)
  const debouncedType = useDebouncedValue(typeFilter, 150)
  const debouncedDomain = useDebouncedValue(domainFilter, 150)
  const debouncedTime = useDebouncedValue(timeRange, 150)

  const infiniteOptions: Omit<EmailLogsOptions, 'offset'> = {
    searchQuery: debouncedSearch,
    statusFilter: debouncedStatus as any,
    typeFilter: debouncedType as any,
    domainFilter: debouncedDomain,
    timeRange: debouncedTime as any,
    limit: 50,
  }

  const {
    data,
    isLoading,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteUnifiedEmailLogsQuery(infiniteOptions)

  const firstPage = data?.pages?.[0]
  const stats = firstPage?.stats
  const filtersUniqueDomains = firstPage?.filters?.uniqueDomains ?? []

  const { ref: sentinelRef, hasIntersected } = useIntersectionObserver({ rootMargin: '400px' })
  useEffect(() => {
    if (hasIntersected && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [hasIntersected, hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleRefresh = () => {
    setRotationDegrees(prev => prev + 360)
    refetch()
  }

  if (error) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6">
            <div className="flex items-center gap-2 text-destructive">
              <CircleXmark width="16" height="16" />
              <span>{error.message}</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto text-destructive hover:text-destructive/80">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show full page skeleton on initial load
  if (isLoading && !data) {
    return <LogsPageSkeleton />
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-5xl mx-auto px-2">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SidebarToggleButton />
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-1 tracking-tight">
                  Email Flow
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <div
                className={`overflow-hidden origin-right transition-all duration-300 ${
                  (searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || domainFilter !== 'all' || timeRange !== '7d')
                    ? 'opacity-100 scale-x-100 w-auto'
                    : 'opacity-0 scale-x-0 w-0 pointer-events-none'
                }`}
              >
                <Button
                  variant="secondary"
                  size="default"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                    setTypeFilter('all')
                    setDomainFilter('all')
                    setTimeRange('7d')
                  }}
                >
                  <Filter2 width="14" height="14" className="mr-2" />
                  Clear Filters
                </Button>
              </div>
              <Button
                variant="secondary"
                size="default"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <Refresh2 
                  width="14" 
                  height="14" 
                  className="mr-2 transition-transform duration-500"
                  style={{ transform: `rotate(${rotationDegrees}deg)` }}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Magnifier2 width="16" height="16" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 rounded-xl"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[120px] h-9 rounded-xl">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="no_delivery">No Delivery</SelectItem>
                <SelectItem value="parse_failed">Parse Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl">
                <SelectValue placeholder="Domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {filtersUniqueDomains.map((domain: string) => (
                  <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="mb-6 bg-muted/30 border border-border rounded-xl p-2">
            <div className="flex items-center gap-6 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <EnvelopeArrowLeft width="14" height="14" fill="#9333ea" secondaryfill="#9333ea" />
                <span className="text-muted-foreground">Inbound:</span>
                <span className="font-medium text-foreground">{stats.inbound}</span>
              </div>
              <div className="flex items-center gap-2">
                <EnvelopeArrowRight width="14" height="14" fill="#3b82f6" secondaryfill="#3b82f6" />
                <span className="text-muted-foreground">Outbound:</span>
                <span className="font-medium text-foreground">{stats.outbound}</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck width="14" height="14" className="text-green-600" />
                <span className="text-muted-foreground">Delivered:</span>
                <span className="font-medium text-foreground">{stats.delivered}</span>
              </div>
              <div className="flex items-center gap-2">
                <TabClose width="14" height="14" className="text-destructive" />
                <span className="text-muted-foreground">Failed:</span>
                <span className="font-medium text-foreground">{stats.failed}</span>
              </div>
              <div className="flex items-center gap-2">
                <CirclePlay width="14" height="14" className="text-yellow-600" />
                <span className="text-muted-foreground">Pending:</span>
                <span className="font-medium text-foreground">{stats.pending}</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleDots width="14" height="14" className="text-muted-foreground" />
                <span className="text-muted-foreground">No Delivery:</span>
                <span className="font-medium text-foreground">{stats.noDelivery}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock2 width="14" height="14" className="text-muted-foreground" />
                <span className="text-muted-foreground">Avg Processing:</span>
                <span className="font-medium text-foreground">{Math.round(stats.avgProcessingTime)}ms</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logs List - Edge to Edge */}
      <div className="w-full max-w-5xl mx-auto px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground">Loading emails...</div>
          </div>
        ) : !((data?.pages?.flatMap(p => p.emails) || []).length) ? (
          <div className="max-w-5xl mx-auto">
            <Card className=" rounded-xl p-8">
              <div className="text-center">
                <Database2 width="48" height="48" className="text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">No emails found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || domainFilter !== 'all' || timeRange !== '7d'
                    ? 'Try adjusting your filters or search query.'
                    : 'Start receiving or sending emails to see logs here.'}
                </p>
              </div>
            </Card>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(data?.pages ?? []).flatMap(p => p.emails).map((log) => {
              const isInbound = log.type === 'inbound'
              const inboundLog = isInbound ? log as InboundEmailLogEntry : null
              const outboundLog = !isInbound ? log as OutboundEmailLogEntry : null

              return (
                <Link
                  key={log.id}
                  href={`/logs/${log.id}`}
                  className="flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  {/* Type Icon with Status Dot */}
                  <div className="flex-shrink-0">
                    <div className="relative p-1 bg-muted rounded-md">
                      {getTypeIcon(log)}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="flex-shrink-0 w-20 text-xs font-mono text-muted-foreground">
                    <div>{format(new Date(log.createdAt), 'HH:mm:ss')}</div>
                    {(() => {
                      const now = new Date()
                      const logTime = new Date(log.createdAt)
                      const diffInMinutes = Math.floor((now.getTime() - logTime.getTime()) / (1000 * 60))
                      
                      if (diffInMinutes < 60) {
                        return <div className="text-[10px] opacity-75">{diffInMinutes}m ago</div>
                      }
                      return null
                    })()}
                  </div>

                  {/* From */}
                  <div className="flex-shrink-0 w-48 truncate">
                    <span className="text-sm font-medium">{log.from}</span>
                  </div>

                  {/* To/Recipient */}
                  <div className="flex-shrink-0 w-48 truncate">
                    {isInbound && inboundLog ? (
                      <span className="text-sm">{inboundLog.recipient}</span>
                    ) : (
                      outboundLog && (
                        <span className="text-sm">
                          {outboundLog.to.length > 1 ? `${outboundLog.to[0]} +${outboundLog.to.length - 1}` : outboundLog.to[0]}
                        </span>
                      )
                    )}
                  </div>

                  {/* Subject */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">{log.subject}</span>
                      {log.hasAttachments && (
                        <Hashtag2 width="14" height="14" className="text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {log.domain} • {isInbound ? 'Inbound' : 'Outbound'}
                    </div>
                  </div>

                  {/* Status/Delivery Info */}
                  <div className="flex-shrink-0 text-right">
                    {isInbound && inboundLog ? (
                      inboundLog.deliveries.length > 0 ? (
                        <div className="text-xs">
                          <div className="font-medium">
                            {inboundLog.deliveries[0].config?.name || 'Unknown'}
                          </div>
                          <div className="text-muted-foreground">
                            {inboundLog.deliveries[0].responseCode ? `${inboundLog.deliveries[0].responseCode}` :
                              inboundLog.deliveries[0].error ? 'Error' :
                                inboundLog.deliveries[0].status}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No delivery</span>
                      )
                    ) : (
                      outboundLog && (
                        <div className="text-xs">
                          <div className="font-medium capitalize">{outboundLog.status}</div>
                          <div className="text-muted-foreground uppercase">{outboundLog.provider}</div>
                        </div>
                      )
                    )}
                  </div>


                  {/* Processing time / Timing info */}
                  <div className="flex-shrink-0 text-xs text-muted-foreground">
                    {isInbound && inboundLog ?
                      `${inboundLog.processingTimeMs}ms` :
                      outboundLog?.sentAt ? format(new Date(outboundLog.sentAt), 'HH:mm') : 'Pending'
                    }
                  </div>

                  {/* Visual indicator for clickable row */}
                  <div className="flex-shrink-0">
                    <ArrowUpRight2 width="12" height="12" className="text-muted-foreground" />
                  </div>
                </Link>
              )
            })}
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef as any} className="h-12 flex items-center justify-center">
              {isFetchingNextPage && (
                <div className="text-muted-foreground text-sm">Loading more…</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail sheet removed. */}
    </div>
  )
} 
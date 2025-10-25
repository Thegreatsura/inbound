"use client"

import { useEffect, useState, useMemo, Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import ShieldAlert from '@/components/icons/shield-alert'
import Ban2 from '@/components/icons/ban-2'
import ArrowUpRight2 from '@/components/icons/arrow-up-right-2'
import ArchiveDownload from '@/components/icons/archive-download'
import ArchiveExport from '@/components/icons/archive-export'
import EnvelopeArrowLeft from '@/components/icons/envelope-arrow-left'
import EnvelopeArrowRight from '@/components/icons/envelope-arrow-right'

import { useInfiniteUnifiedEmailLogsQuery } from '@/features/emails/hooks'
import { useDomainsListV2Query } from '@/features/domains/hooks/useDomainV2Hooks'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { EmailLogsOptions, EmailLogEntry, InboundEmailLogEntry, OutboundEmailLogEntry } from '@/features/emails/types'
import SidebarToggleButton from '@/components/sidebar-toggle-button'
import { Card } from '@/components/ui/card'
import Paperclip2 from '@/components/icons/paperclip-2'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { getEmailVolumeChartData } from '@/app/actions/primary'

// Configuration constants
const DOMAINS_FETCH_LIMIT = 500 // Reasonable limit for domain dropdown - if users have more domains, 
                                 // consider implementing search/autocomplete or pagination

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
  const [guardFilter, setGuardFilter] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('24h')
  const [selectedLog, setSelectedLog] = useState<EmailLogEntry | null>(null)
  const [rotationDegrees, setRotationDegrees] = useState(0)

  // Debounce inputs to cut request volume
  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  const debouncedStatus = useDebouncedValue(statusFilter, 150)
  const debouncedType = useDebouncedValue(typeFilter, 150)
  const debouncedDomain = useDebouncedValue(domainFilter, 150)
  const debouncedGuard = useDebouncedValue(guardFilter, 150)
  const debouncedTime = useDebouncedValue(timeRange, 150)

  const infiniteOptions: Omit<EmailLogsOptions, 'offset'> = useMemo(() => ({
    searchQuery: debouncedSearch,
    statusFilter: debouncedStatus as any,
    typeFilter: debouncedType as any,
    domainFilter: debouncedDomain,
    guardFilter: debouncedGuard as any,
    timeRange: debouncedTime as any,
    limit: 50,
  }), [debouncedSearch, debouncedStatus, debouncedType, debouncedDomain, debouncedGuard, debouncedTime])

  const {
    data,
    isLoading,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isFetching,
  } = useInfiniteUnifiedEmailLogsQuery(infiniteOptions)

  // Fetch chart data based on time range
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['email-volume-chart', debouncedTime],
    queryFn: async () => {
      const result = await getEmailVolumeChartData(debouncedTime as any)
      if (!result.success) {
        console.error('Chart data fetch failed:', result.error)
        return null
      }
      return result.data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1, // Only retry once on failure
    retryDelay: 1000, // Wait 1 second before retry
  })

  // Fetch all available domains for the filter dropdown
  const { 
    data: domainsResponse, 
    isLoading: domainsLoading, 
    error: domainsError 
  } = useDomainsListV2Query({ limit: DOMAINS_FETCH_LIMIT })
  
  const allAvailableDomains = domainsResponse?.data?.map(domain => domain.domain).sort() ?? []
  const hasMoreDomains = domainsResponse?.pagination?.total && domainsResponse.pagination.total > DOMAINS_FETCH_LIMIT

  const firstPage = data?.pages?.[0]
  const stats = firstPage?.stats
  // Use all available domains instead of just from current results
  const filtersUniqueDomains = allAvailableDomains

  const { ref: sentinelRef, hasIntersected } = useIntersectionObserver({ rootMargin: '400px' })
  useEffect(() => {
    if (hasIntersected && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [hasIntersected, hasNextPage, isFetchingNextPage]) // Removed fetchNextPage from deps

  const handleRefresh = () => {
    // Spin counter-clockwise (negative rotation) like typical refresh icons
    setRotationDegrees(prev => prev - 360)
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

        {/* Search and Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            {/* Search - takes up most space */}
            <div className="relative flex-1">
              <Magnifier2 width="16" height="16" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 rounded-xl"
              />
            </div>

            {/* Filters Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="default" className="h-9 rounded-xl">
                  <Filter2 width="16" height="16" className="mr-2" />
                  Filters
                  {(typeFilter !== 'all' || statusFilter !== 'all' || guardFilter !== 'all' || domainFilter !== 'all') && (
                    <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                      {[
                        typeFilter !== 'all',
                        statusFilter !== 'all',
                        guardFilter !== 'all',
                        domainFilter !== 'all'
                      ].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-3">Filter Email Logs</h4>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="h-9 rounded-xl">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 rounded-xl">
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
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Guard</label>
                      <Select value={guardFilter} onValueChange={setGuardFilter}>
                        <SelectTrigger className="h-9 rounded-xl">
                          <SelectValue placeholder="Guard" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Emails</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="allowed">Allowed</SelectItem>
                          <SelectItem value="flagged">Flagged</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Domain</label>
            <Select 
              value={domainFilter} 
              onValueChange={setDomainFilter}
              disabled={domainsLoading}
            >
                        <SelectTrigger className="h-9 rounded-xl">
                          <SelectValue placeholder={domainsLoading ? "Loading..." : "All Domains"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {domainsLoading ? (
                  <SelectItem value="loading" disabled>
                              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <div 
                        className="w-3 h-3 border border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" 
                        aria-label="Loading domains"
                      />
                                Loading...
                    </div>
                  </SelectItem>
                ) : domainsError ? (
                  <SelectItem value="error" disabled>
                              <div className="flex items-center gap-2 text-destructive text-xs">
                      <CircleXmark width="12" height="12" />
                                Failed
                    </div>
                  </SelectItem>
                ) : filtersUniqueDomains.length > 0 ? (
                  <>
                    {filtersUniqueDomains.map((domain: string) => (
                      <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                    ))}
                    {hasMoreDomains && (
                      <SelectItem value="more-domains" disabled>
                        <div className="text-xs text-muted-foreground">
                                    + {(domainsResponse?.pagination?.total ?? 0) - DOMAINS_FETCH_LIMIT} more...
                        </div>
                      </SelectItem>
                    )}
                  </>
                ) : (
                            <SelectItem value="no-domains" disabled>No domains</SelectItem>
                )}
              </SelectContent>
            </Select>
                    </div>
                  </div>

                  {(typeFilter !== 'all' || statusFilter !== 'all' || guardFilter !== 'all' || domainFilter !== 'all') && (
                    <>
                      <Separator />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTypeFilter('all')
                          setStatusFilter('all')
                          setGuardFilter('all')
                          setDomainFilter('all')
                        }}
                        className="w-full"
                      >
                        Clear All Filters
                      </Button>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Time Range - Outside of popover */}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="h-9 rounded-xl w-[150px]">
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

        {/* Stats Bar with Chart */}
        {stats && (
          <div className="mb-6 bg-muted/30 border border-border rounded-xl overflow-hidden relative">
            {/* Loading overlay for stats when filters change */}
            {isFetching && !isLoading && !isFetchingNextPage && (
              <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
                <div className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              </div>
            )}
            
            {/* Email Volume Chart */}
            <div className="p-4 pb-2 relative">
              {chartData && chartData.chartData ? (
                <div className="h-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          if (chartData.intervalType === 'hour') {
                            return date.toLocaleTimeString(undefined, { hour: 'numeric' })
                          }
                          return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        }}
                        stroke="#888"
                        hide
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12px'
                        }}
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          if (chartData.intervalType === 'hour') {
                            return date.toLocaleString(undefined, { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: 'numeric',
                              minute: '2-digit'
                            })
                          }
                          return date.toLocaleDateString(undefined, { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })
                        }}
                        formatter={(value: number, name: string) => {
                          return [value, name === 'inbound' ? 'Inbound' : 'Outbound'];
                        }}
                      />
                      <Bar dataKey="inbound" stackId="emails" fill="#9333ea" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="outbound" stackId="emails" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-10 flex items-center justify-center">
                  {isChartLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                      <span className="text-xs">Loading chart...</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No chart data</span>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="px-3 pb-3 pt-2">
              <div className="flex items-center justify-center gap-4 lg:gap-6 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                  <EnvelopeArrowLeft width="16" height="16" fill="#9333ea" secondaryfill="#9333ea" />
                  <span className="text-muted-foreground whitespace-nowrap">Inbound:</span>
                  <span className="font-semibold text-foreground tabular-nums">{stats.inbound}</span>
              </div>
              <div className="flex items-center gap-2">
                  <EnvelopeArrowRight width="16" height="16" fill="#3b82f6" secondaryfill="#3b82f6" />
                  <span className="text-muted-foreground whitespace-nowrap">Outbound:</span>
                  <span className="font-semibold text-foreground tabular-nums">{stats.outbound}</span>
              </div>
              <div className="flex items-center gap-2">
                  <CircleCheck width="16" height="16" className="text-green-600" />
                  <span className="text-muted-foreground whitespace-nowrap">Delivered:</span>
                  <span className="font-semibold text-foreground tabular-nums">{stats.delivered}</span>
              </div>
              <div className="flex items-center gap-2">
                  <TabClose width="16" height="16" className="text-destructive" />
                  <span className="text-muted-foreground whitespace-nowrap">Failed:</span>
                  <span className="font-semibold text-foreground tabular-nums">{stats.failed}</span>
              </div>
              <div className="flex items-center gap-2">
                  <CirclePlay width="16" height="16" className="text-yellow-600" />
                  <span className="text-muted-foreground whitespace-nowrap">Pending:</span>
                  <span className="font-semibold text-foreground tabular-nums">{stats.pending}</span>
              </div>
              <div className="flex items-center gap-2">
                  <CircleDots width="16" height="16" className="text-muted-foreground" />
                  <span className="text-muted-foreground whitespace-nowrap">No Delivery:</span>
                  <span className="font-semibold text-foreground tabular-nums">{stats.noDelivery}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logs List - Edge to Edge */}
      <div className="w-full max-w-5xl mx-auto px-2 relative">
        {/* Loading overlay when filters are being applied */}
        {isFetching && !isLoading && !isFetchingNextPage && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] z-20 rounded-xl flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground bg-background px-4 py-2 rounded-xl border border-border shadow-sm">
              <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              <span className="text-sm font-medium">Updating results...</span>
            </div>
          </div>
        )}
        
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
                  {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || domainFilter !== 'all' || guardFilter !== 'all' || timeRange !== '24h'
                    ? 'Try adjusting your filters or search query.'
                    : 'Start receiving or sending emails to see logs here.'}
                </p>
              </div>
            </Card>
          </div>
        ) : (
          <div className="border border-border rounded-[13px] bg-card overflow-hidden">
            {(data?.pages ?? []).flatMap(p => p.emails).map((log) => {
              const isInbound = log.type === 'inbound'
              const inboundLog = isInbound ? log as InboundEmailLogEntry : null
              const outboundLog = !isInbound ? log as OutboundEmailLogEntry : null

              // Check if this is a blocked email
              const isBlocked = isInbound && inboundLog?.guardBlocked

              // Get status badge info
              const getStatusInfo = () => {
                if (isInbound && inboundLog) {
                  const hasDeliveries = inboundLog.deliveries.length > 0
                  const hasSuccessfulDelivery = inboundLog.deliveries.some(d => d.status === 'success')
                  const hasFailedDelivery = inboundLog.deliveries.some(d => d.status === 'failed')
                  
                  if (isBlocked) {
                    return { label: 'Blocked', variant: 'destructive' as const }
                  } else if (!inboundLog.parseSuccess) {
                    return { label: 'Parse failed', variant: 'destructive' as const }
                  } else if (hasSuccessfulDelivery) {
                    return { label: inboundLog.deliveries[0].config?.name || 'Delivered', variant: 'default' as const }
                  } else if (hasFailedDelivery) {
                    return { label: 'Delivery failed', variant: 'destructive' as const }
                  } else if (!hasDeliveries) {
                    return { label: 'No delivery', variant: 'secondary' as const }
                  }
                  return { label: 'Pending', variant: 'secondary' as const }
                } else if (outboundLog) {
                  if (outboundLog.status === 'sent') {
                    return { label: 'Sent', variant: 'default' as const }
                  } else if (outboundLog.status === 'failed') {
                    return { label: 'Failed', variant: 'destructive' as const }
                  }
                  return { label: 'Pending', variant: 'secondary' as const }
                }
                return { label: 'Unknown', variant: 'secondary' as const }
              }

              const statusInfo = getStatusInfo()

              return (
                <Link
                  key={log.id}
                  href={`/logs/${log.id}`}
                  className={`flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border last:border-b-0 ${
                    isBlocked ? 'bg-red-50' : ''
                  }`}
                >
                  {/* From/To Email Column */}
                  <div className="flex-shrink-0 w-40 sm:w-52">
                    <div className="text-sm font-medium text-foreground truncate">
                      {log.from}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {isInbound && inboundLog ? inboundLog.recipient : outboundLog?.to[0]}
                    </div>
                  </div>

                  {/* Subject and Details Column */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate mb-1">
                      {log.subject}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {/* <span className="hidden sm:inline">Endpoint:</span>
                      <span className="text-orange-600 font-medium">
                        {isInbound && inboundLog?.deliveries[0]?.config?.name || (isInbound ? 'None' : outboundLog?.provider?.toUpperCase())}
                      </span> */}
                      {/* <span className="hidden md:inline">•</span> */}
                      <span className="hidden md:inline text-green-600">
                        {isInbound && inboundLog ? `${inboundLog.processingTimeMs}ms` : outboundLog?.sentAt ? format(new Date(outboundLog.sentAt), 'HH:mm') : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Attachments Icon (hidden on small screens) */}
                  {log.hasAttachments && (
                    <div className="flex-shrink-0 hidden lg:flex items-center gap-1 text-orange-500">
                      <Paperclip2 width="16" height="16" />
                      <span className="text-xs font-medium">
                        {(() => {
                          if (isInbound && inboundLog) {
                            // Try to parse attachments from the email
                            return '1'
                          }
                          return '1'
                        })()}
                      </span>
                        </div>
                    )}

                  {/* Status Badge */}
                  <div className="flex-shrink-0 w-32 sm:w-40 text-right">
                    <Badge 
                      variant={statusInfo.variant}
                      className={statusInfo.variant === 'default' ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' : statusInfo.variant === 'destructive' ? 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200' : ''}
                    >
                      {statusInfo.label}
                    </Badge>
                  </div>

                  {/* Arrow Icon (hidden on mobile) */}
                  <div className="flex-shrink-0 hidden sm:block">
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
    </div>
  )
} 
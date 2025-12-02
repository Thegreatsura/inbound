'use client'

import * as React from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Search, X, ArrowUpDown, ChevronLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { 
  useAdminTenantsQuery, 
  useAdminSESAccountStatsQuery,
  type TenantWithMetrics,
  type AdminTenantsQueryParams
} from '@/features/admin/hooks'
import Refresh2 from '@/components/icons/refresh-2'
import ChartTrendUp from '@/components/icons/chart-trend-up'
import Envelope2 from '@/components/icons/envelope-2'
import CircleWarning2 from '@/components/icons/circle-warning-2'
import ShieldCheck from '@/components/icons/shield-check'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

type SortField = 'tenantName' | 'createdAt' | 'sends' | 'receives'
type SortDirection = 'asc' | 'desc'

const PAGE_SIZE = 50

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}


function getStatusBadgeVariant(status: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ENABLED':
    case 'REINSTATED':
      return 'default'
    case 'DISABLED':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getScoreColorClass(score: number, type: 'complaint' | 'bounce'): string {
  // AWS thresholds: bounce > 5% is bad, complaint > 0.1% is bad
  if (type === 'bounce') {
    if (score <= 2) return 'text-emerald-600'
    if (score <= 5) return 'text-amber-600'
    return 'text-red-600'
  }
  // Complaint rate
  if (score <= 0.05) return 'text-emerald-600'
  if (score <= 0.1) return 'text-amber-600'
  return 'text-red-600'
}

function SESAccountStats() {
  const { data: stats, isLoading, error } = useAdminSESAccountStatsQuery()

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-6 mb-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return null
  }

  return (
    <div className="grid gap-3 md:grid-cols-6 mb-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <ShieldCheck width="14" height="14" />
            Sending Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant={stats.sendingEnabled ? 'default' : 'destructive'}>
            {stats.sendingEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <p className="text-[10px] text-muted-foreground mt-1">
            {stats.enforcementStatus}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Envelope2 width="14" height="14" />
            Sent (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">{formatNumber(stats.sentLast24Hours)}</div>
          <p className="text-[10px] text-muted-foreground">
            of {formatNumber(stats.max24HourSend)} quota
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <ChartTrendUp width="14" height="14" />
            Sends (7d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">{formatNumber(stats.sends7d)}</div>
          <p className="text-[10px] text-muted-foreground">
            from CloudWatch
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <CircleWarning2 width="14" height="14" />
            Bounces (7d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn('text-xl font-bold', getScoreColorClass(stats.bounceRate7d, 'bounce'))}>
            {formatNumber(stats.bounces7d)}
          </div>
          <p className={cn('text-[10px]', getScoreColorClass(stats.bounceRate7d, 'bounce'))}>
            {stats.bounceRate7d.toFixed(2)}% rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <CircleWarning2 width="14" height="14" />
            Complaints (7d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn('text-xl font-bold', getScoreColorClass(stats.complaintRate7d, 'complaint'))}>
            {formatNumber(stats.complaints7d)}
          </div>
          <p className={cn('text-[10px]', getScoreColorClass(stats.complaintRate7d, 'complaint'))}>
            {stats.complaintRate7d.toFixed(3)}% rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <ChartTrendUp width="14" height="14" />
            Quota Left
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">{formatNumber(stats.remainingQuota)}</div>
          <p className="text-[10px] text-muted-foreground">
            {((stats.remainingQuota / stats.max24HourSend) * 100).toFixed(1)}% • {formatNumber(stats.maxSendRate)}/s
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function TenantTable() {
  const [search, setSearch] = React.useState('')
  const [expandedTenants, setExpandedTenants] = React.useState<Set<string>>(new Set())
  const [sortField, setSortField] = React.useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')
  const [page, setPage] = React.useState(0)

  // Debounce search to avoid excessive requests
  const debouncedSearch = useDebouncedValue(search, 300)

  // Reset page when search changes
  React.useEffect(() => {
    setPage(0)
  }, [debouncedSearch])

  const queryParams: AdminTenantsQueryParams = {
    search: debouncedSearch || undefined,
    sortBy: sortField,
    sortOrder: sortDirection,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }

  const { data, isLoading, error, refetch, isFetching } = useAdminTenantsQuery(queryParams)

  const tenants = data?.tenants || []
  const total = data?.total || 0
  const hasMore = data?.pagination?.hasMore || false
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const toggleExpanded = (tenantId: string) => {
    const next = new Set(expandedTenants)
    if (next.has(tenantId)) {
      next.delete(tenantId)
    } else {
      next.add(tenantId)
    }
    setExpandedTenants(next)
  }

  const expandAll = () => {
    setExpandedTenants(new Set(tenants.map((t) => t.id)))
  }

  const collapseAll = () => {
    setExpandedTenants(new Set())
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setPage(0) // Reset to first page on sort change
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  )

  if (isLoading && page === 0) {
    return (
      <div className="w-full">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="border rounded-sm">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2 border-b last:border-b-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <CircleWarning2 width="16" height="16" />
            <span>{error instanceof Error ? error.message : 'Failed to load tenants'}</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tenants, users, or domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 pr-7 h-8 text-sm rounded-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 px-2.5 text-xs rounded-sm"
          >
            <Refresh2 width="14" height="14" className={isFetching ? 'animate-spin' : ''} />
          </Button>

          <div className="flex items-center border rounded-sm">
            <Button variant="ghost" size="sm" onClick={expandAll} className="rounded-none border-r h-8 px-2 text-xs">
              Expand all
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} className="rounded-none h-8 px-2 text-xs">
              Collapse
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
        <span>
          {total} tenant{total !== 1 ? 's' : ''} total
          {debouncedSearch && ` matching "${debouncedSearch}"`}
          {total > PAGE_SIZE && ` • Showing ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)}`}
        </span>
        {isFetching && <span className="text-muted-foreground">Loading...</span>}
      </div>

      <div className="border rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-8"></th>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-[180px]">
                  <SortButton field="tenantName">Tenant</SortButton>
                </th>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-[140px]">Owner</th>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-[80px]">Status</th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[70px]">
                  <SortButton field="sends">Sends</SortButton>
                </th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[70px]">
                  <SortButton field="receives">Receives</SortButton>
                </th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[60px]">Bounces</th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[70px]">Complaints</th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[50px]">Domains</th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[80px]">
                  <SortButton field="createdAt">Created</SortButton>
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-2 py-6 text-center text-muted-foreground">
                    No tenants found.
                  </td>
                </tr>
              )}
              {tenants.map((tenant) => (
                <React.Fragment key={tenant.id}>
                  <tr
                    className={cn(
                      'border-b hover:bg-muted/30 cursor-pointer transition-colors',
                      expandedTenants.has(tenant.id) && 'bg-muted/20'
                    )}
                    onClick={() => toggleExpanded(tenant.id)}
                  >
                    <td className="px-2 py-1">
                      {expandedTenants.has(tenant.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <div>
                        <div className="font-medium truncate">{tenant.tenantName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {tenant.configurationSetName || 'No config set'}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <div className="truncate">
                        <div className="font-medium truncate">{tenant.userName || 'Unknown'}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{tenant.userEmail}</div>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <Badge
                        variant={getStatusBadgeVariant(tenant.awsSendingStatus)}
                        className="text-[10px] px-1.5 py-0 rounded-sm"
                      >
                        {tenant.awsSendingStatus || tenant.status || 'Unknown'}
                      </Badge>
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {formatNumber(tenant.metrics.sends)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {formatNumber(tenant.metrics.receives)}
                    </td>
                    <td className={cn(
                      'px-2 py-1 text-right font-mono',
                      tenant.metrics.bounces > 0 ? 'text-amber-600' : 'text-muted-foreground'
                    )}>
                      {formatNumber(tenant.metrics.bounces)}
                    </td>
                    <td className={cn(
                      'px-2 py-1 text-right font-mono',
                      tenant.metrics.complaints > 0 ? 'text-red-600' : 'text-muted-foreground'
                    )}>
                      {formatNumber(tenant.metrics.complaints)}
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {tenant.domains.length}
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground text-[10px]">
                      {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>

                  {/* Expanded domains */}
                  {expandedTenants.has(tenant.id) &&
                    tenant.domains.map((domain, idx) => (
                      <tr
                        key={`${tenant.id}-${domain.domain}`}
                        className={cn(
                          'bg-muted/10 text-muted-foreground',
                          idx === tenant.domains.length - 1 ? 'border-b' : ''
                        )}
                      >
                        <td className="px-2 py-1"></td>
                        <td className="px-2 py-1 pl-6" colSpan={2}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground/60">└</span>
                            <span className="font-mono text-foreground">{domain.domain}</span>
                            <Badge
                              variant={domain.status === 'verified' ? 'outline' : 'secondary'}
                              className="text-[10px] px-1 py-0 rounded-sm"
                            >
                              {domain.status}
                            </Badge>
                            {domain.canReceiveEmails && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 rounded-sm">
                                Receive
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1" colSpan={7}></td>
                      </tr>
                    ))}

                  {/* Show message if no domains */}
                  {expandedTenants.has(tenant.id) && tenant.domains.length === 0 && (
                    <tr className="bg-muted/10 border-b">
                      <td className="px-2 py-1"></td>
                      <td className="px-2 py-1 pl-6 text-muted-foreground italic" colSpan={9}>
                        No domains associated
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(0)}
              disabled={page === 0 || isFetching}
              className="h-7 px-2 text-xs"
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || isFetching}
              className="h-7 px-2 text-xs"
            >
              <ChevronLeft className="h-3 w-3" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore || isFetching}
              className="h-7 px-2 text-xs"
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1 || isFetching}
              className="h-7 px-2 text-xs"
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TenantPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="px-3 py-4 overflow-auto">
        <div className="mb-3">
          <h1 className="text-lg font-semibold tracking-tight">Tenant Data</h1>
          <p className="text-muted-foreground text-xs">
            Sends/Receives from DB (24h) • Bounces/Complaints from CloudWatch (7d)
          </p>
        </div>
        <SESAccountStats />
        <TenantTable />
      </div>
    </main>
  )
}

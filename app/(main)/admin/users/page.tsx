'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, Search, X, ArrowUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { 
  useAdminUsersQuery,
  type TopUserActivity,
} from '@/features/admin/hooks'
import UserGroup from '@/components/icons/user-group'
import Envelope2 from '@/components/icons/envelope-2'
import ChartTrendUp from '@/components/icons/chart-trend-up'
import Activity2 from '@/components/icons/chart-activity-2'
import CircleWarning2 from '@/components/icons/circle-warning-2'
import Ban2 from '@/components/icons/ban-2'
import ShieldCheck from '@/components/icons/shield-check'
import Refresh2 from '@/components/icons/refresh-2'
import Eye from '@/components/icons/eye-2'
import Download2 from '@/components/icons/download-2'
import { exportUserEmails } from '@/app/actions/user-analytics'

type SortField = 'name' | 'email' | 'totalEmails' | 'riskScore' | 'joinedAt'
type SortDirection = 'asc' | 'desc'

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

function getRiskColor(score: number): string {
  if (score >= 80) return 'text-red-500'
  if (score >= 60) return 'text-orange-500'
  if (score >= 40) return 'text-yellow-600'
  return 'text-green-600'
}

function OverviewStats({ data }: { data: { 
  totalUsers: number
  activeUsers: number
  bannedUsers: number
  totalEmailsSent: number
  totalEmailsReceived: number
  emailsLast24h: number
  emailsLast7d: number
  avgEmailsPerUser: number
}}) {
  return (
    <div className="grid gap-3 md:grid-cols-4 mb-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <UserGroup width="14" height="14" />
            Total Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">{formatNumber(data.totalUsers)}</div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="text-green-600">{data.activeUsers} active</span>
            {data.bannedUsers > 0 && (
              <>
                <span>•</span>
                <span className="text-red-600">{data.bannedUsers} banned</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Envelope2 width="14" height="14" />
            Total Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">
            {formatNumber(data.totalEmailsSent + data.totalEmailsReceived)}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="text-blue-600">{formatNumber(data.totalEmailsReceived)} received</span>
            <span>•</span>
            <span className="text-green-600">{formatNumber(data.totalEmailsSent)} sent</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Activity2 width="14" height="14" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">{formatNumber(data.emailsLast24h)}</div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Last 24h</span>
            <span>•</span>
            <span>{formatNumber(data.emailsLast7d)} last 7d</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <ChartTrendUp width="14" height="14" />
            Avg per User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">{formatNumber(data.avgEmailsPerUser)}</div>
          <p className="text-[10px] text-muted-foreground">
            Emails per registered user
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function UsersTableContent({ 
  users, 
  onViewUser,
  onExportUser 
}: { 
  users: TopUserActivity[]
  onViewUser: (user: TopUserActivity) => void
  onExportUser: (userId: string, userEmail: string) => void
}) {
  const [search, setSearch] = React.useState('')
  const [sortField, setSortField] = React.useState<SortField>('totalEmails')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const filteredAndSortedUsers = React.useMemo(() => {
    let result = [...users]

    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (user) =>
          user.userName?.toLowerCase().includes(searchLower) ||
          user.userEmail.toLowerCase().includes(searchLower)
      )
    }

    result.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      switch (sortField) {
        case 'name':
          aVal = (a.userName || '').toLowerCase()
          bVal = (b.userName || '').toLowerCase()
          break
        case 'email':
          aVal = a.userEmail.toLowerCase()
          bVal = b.userEmail.toLowerCase()
          break
        case 'totalEmails':
          aVal = a.totalEmails
          bVal = b.totalEmails
          break
        case 'riskScore':
          aVal = a.riskScore
          bVal = b.riskScore
          break
        case 'joinedAt':
          aVal = new Date(a.joinedAt).getTime()
          bVal = new Date(b.joinedAt).getTime()
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return result
  }, [users, search, sortField, sortDirection])

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

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search users..."
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
      </div>

      <div className="text-xs text-muted-foreground mb-1.5">
        {filteredAndSortedUsers.length} user{filteredAndSortedUsers.length !== 1 ? 's' : ''}
        {search && ` matching "${search}"`}
      </div>

      <div className="border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs">
                <SortButton field="name">User</SortButton>
              </TableHead>
              <TableHead className="text-xs text-right">
                <SortButton field="totalEmails">Total Emails</SortButton>
              </TableHead>
              <TableHead className="text-xs text-right">Sent / Received</TableHead>
              <TableHead className="text-xs text-right">Recent</TableHead>
              <TableHead className="text-xs text-right">
                <SortButton field="riskScore">Risk</SortButton>
              </TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedUsers.map((user, index) => (
                <TableRow key={user.userId} className={index < 3 ? 'bg-muted/10' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {index < 3 && (
                        <div className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          'bg-orange-600 text-white'
                        )}>
                          {index + 1}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-medium">{user.userName || 'No name'}</div>
                        <div className="text-[10px] text-muted-foreground">{user.userEmail}</div>
                        {user.role === 'admin' && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 mt-0.5">
                            <ShieldCheck width="10" height="10" className="mr-0.5" />
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono text-sm font-bold">
                      {formatNumber(user.totalEmails)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-end gap-2 text-[10px]">
                        <span className="text-green-600">↑ {formatNumber(user.sentEmails)}</span>
                        <span className="text-blue-600">↓ {formatNumber(user.receivedEmails)}</span>
                      </div>
                      <Progress 
                        value={user.totalEmails > 0 ? (user.sentEmails / user.totalEmails) * 100 : 0} 
                        className="h-1 w-20 ml-auto"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-[10px] space-y-0.5">
                      <div>7d: {formatNumber(user.emailsLast7d)}</div>
                      <div className="text-muted-foreground">30d: {formatNumber(user.emailsLast30d)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className={cn('font-mono text-xs font-bold', getRiskColor(user.riskScore))}>
                        {user.riskScore}
                      </span>
                      <Progress value={user.riskScore} className="h-1.5 w-10" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {user.banned ? (
                        <Badge variant="destructive" className="text-[10px] px-1 py-0">
                          <Ban2 width="10" height="10" className="mr-0.5" />
                          Banned
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px] px-1 py-0">Active</Badge>
                      )}
                      {user.flags.length > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          {user.flags.slice(0, 2).join(', ')}
                          {user.flags.length > 2 && ` +${user.flags.length - 2}`}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onViewUser(user)}
                      >
                        <Eye width="12" height="12" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => onExportUser(user.userId, user.userEmail)}
                        title="Export emails"
                      >
                        <Download2 width="12" height="12" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function UserDetailsDialog({ 
  user, 
  open, 
  onOpenChange 
}: { 
  user: TopUserActivity | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            User Details: {user.userName || 'Unknown User'}
          </DialogTitle>
          <DialogDescription className="text-xs">{user.userEmail}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {formatNumber(user.receivedEmails)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Received</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {formatNumber(user.sentEmails)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Sent</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-medium mb-1">Account Info</div>
              <div className="space-y-0.5 text-muted-foreground">
                <div>Role: {user.role || 'user'}</div>
                <div>Joined: {new Date(user.joinedAt).toLocaleDateString()}</div>
                <div>Status: {user.banned ? 'Banned' : 'Active'}</div>
                {user.lastActivity && (
                  <div>Last Activity: {new Date(user.lastActivity).toLocaleDateString()}</div>
                )}
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">Risk Assessment</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Score:</span>
                  <span className={cn('font-bold', getRiskColor(user.riskScore))}>
                    {user.riskScore}/100
                  </span>
                </div>
                <Progress value={user.riskScore} className="h-1.5" />
              </div>
            </div>
          </div>

          {user.flags.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1">Flags</div>
              <div className="flex flex-wrap gap-1">
                {user.flags.map((flag, index) => (
                  <Badge key={index} variant="outline" className="text-[10px] px-1 py-0">
                    {flag.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t text-center text-xs">
            <div>
              <div className="font-bold">{formatNumber(user.emailsLast7d)}</div>
              <div className="text-[10px] text-muted-foreground">Last 7 days</div>
            </div>
            <div>
              <div className="font-bold">{formatNumber(user.emailsLast30d)}</div>
              <div className="text-[10px] text-muted-foreground">Last 30 days</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ExportDialog({ 
  open, 
  userId,
  userEmail,
  onOpenChange 
}: { 
  open: boolean
  userId: string | null
  userEmail: string | null
  onOpenChange: (open: boolean) => void
}) {
  const handleExport = async (days: 1 | 7 | 30) => {
    if (!userId) return
    const res = await exportUserEmails({ userId, days })
    if (!res.success) return
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-sm">Export emails</DialogTitle>
          <DialogDescription className="text-xs">
            Download {userEmail ? `${userEmail}'s` : 'user'} emails for a selected time range.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {([1, 7, 30] as const).map((d) => (
            <Button
              key={d}
              variant="outline"
              size="sm"
              onClick={() => handleExport(d)}
            >
              {d} day{d === 1 ? '' : 's'}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function UsersPage() {
  const { data, isLoading, error, refetch, isFetching } = useAdminUsersQuery()
  const [selectedUser, setSelectedUser] = React.useState<TopUserActivity | null>(null)
  const [showUserDialog, setShowUserDialog] = React.useState(false)
  const [exportState, setExportState] = React.useState<{ open: boolean; userId: string | null; userEmail: string | null }>({ 
    open: false, 
    userId: null, 
    userEmail: null 
  })

  const handleViewUser = (user: TopUserActivity) => {
    setSelectedUser(user)
    setShowUserDialog(true)
  }

  const handleExportUser = (userId: string, userEmail: string) => {
    setExportState({ open: true, userId, userEmail })
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="px-3 py-4 overflow-auto">
          <div className="mb-3">
            <h1 className="text-lg font-semibold tracking-tight">User Data</h1>
            <p className="text-muted-foreground text-xs">User accounts and activity analytics</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4 mb-4">
            {[...Array(4)].map((_, i) => (
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
          <Skeleton className="h-8 w-64 mb-2" />
          <div className="border rounded-sm">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2 border-b last:border-b-0">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="px-3 py-4 overflow-auto">
          <div className="mb-3">
            <h1 className="text-lg font-semibold tracking-tight">User Data</h1>
            <p className="text-muted-foreground text-xs">User accounts and activity analytics</p>
          </div>
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <CircleWarning2 width="16" height="16" />
                <span className="text-sm">{error instanceof Error ? error.message : 'Failed to load user analytics'}</span>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => refetch()}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  if (!data) return null

  return (
    <main className="min-h-screen bg-background">
      <div className="px-3 py-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">User Data</h1>
            <p className="text-muted-foreground text-xs">User accounts and activity analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              Updated: {new Date(data.cachedAt).toLocaleTimeString()}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-7 px-2"
            >
              <Refresh2 width="14" height="14" className={isFetching ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        <OverviewStats data={data.overview} />

        <UsersTableContent 
          users={data.topUsers} 
          onViewUser={handleViewUser}
          onExportUser={handleExportUser}
        />

        <UserDetailsDialog 
          user={selectedUser} 
          open={showUserDialog} 
          onOpenChange={setShowUserDialog} 
        />

        <ExportDialog
          open={exportState.open}
          userId={exportState.userId}
          userEmail={exportState.userEmail}
          onOpenChange={(open) => !open && setExportState({ open: false, userId: null, userEmail: null })}
        />
      </div>
    </main>
  )
}

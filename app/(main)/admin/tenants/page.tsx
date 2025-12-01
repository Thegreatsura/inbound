"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "@/lib/auth/auth-client"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { getAdminTenantList, getAdminSESAccountStats, type TenantWithMetrics } from "@/app/actions/admin-tenants"
import { cn } from "@/lib/utils"
import { ArrowUpDown, RefreshCw, Search, AlertTriangle, CheckCircle, XCircle, Mail, Users, Globe, TrendingUp, TrendingDown, Minus } from "lucide-react"

type SortField = "tenantName" | "bounceRate" | "complaintRate" | "sends" | "createdAt"
type SortOrder = "asc" | "desc"

export default function AdminTenantsPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tenants, setTenants] = useState<TenantWithMetrics[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortField>("createdAt")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  
  // Account stats
  const [accountStats, setAccountStats] = useState<{
    sendingEnabled: boolean
    enforcementStatus: string
    maxSendRate: number
    max24HourSend: number
    sentLast24Hours: number
    remainingQuota: number
  } | null>(null)

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      // Load tenants and account stats in parallel
      const [tenantsResult, accountResult] = await Promise.all([
        getAdminTenantList({ search: searchQuery, sortBy, sortOrder }),
        getAdminSESAccountStats(),
      ])

      if (!tenantsResult.success) {
        setError(tenantsResult.error || "Failed to load tenants")
        return
      }

      setTenants(tenantsResult.tenants || [])
      setTotal(tenantsResult.total || 0)

      if (accountResult.success) {
        setAccountStats(accountResult.stats || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [searchQuery, sortBy, sortOrder])

  useEffect(() => {
    if (!isPending && session?.user.role === "admin") {
      loadData()
    }
  }, [isPending, session, loadData])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isPending && session?.user.role === "admin") {
        loadData(true)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "ENABLED":
      case "REINSTATED":
        return <Badge variant="default" className="bg-green-500/10 text-green-700 hover:bg-green-500/20">Active</Badge>
      case "DISABLED":
        return <Badge variant="destructive">Disabled</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getRateBadge = (rate: number, type: "bounce" | "complaint") => {
    const threshold = type === "bounce" ? 5 : 0.1 // 5% bounce, 0.1% complaint
    const warningThreshold = type === "bounce" ? 2 : 0.05
    
    if (rate === 0) {
      return <span className="text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" /> 0%</span>
    }
    if (rate >= threshold) {
      return <span className="text-red-600 font-medium flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {rate.toFixed(2)}%</span>
    }
    if (rate >= warningThreshold) {
      return <span className="text-yellow-600 font-medium flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {rate.toFixed(2)}%</span>
    }
    return <span className="text-green-600 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> {rate.toFixed(2)}%</span>
  }

  // Show loading state
  if (isPending || (isLoading && tenants.length === 0)) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        
        {/* Account Stats Skeleton */}
        <div className="grid gap-4 md:grid-cols-4">
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
        
        {/* Table Skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Redirect if not admin
  if (!session || session.user.role !== "admin") {
    return null
  }

  // Calculate aggregated metrics
  const totalSends = tenants.reduce((sum, t) => sum + (t.metrics?.sends || 0), 0)
  const totalBounces = tenants.reduce((sum, t) => sum + (t.metrics?.bounces || 0), 0)
  const totalComplaints = tenants.reduce((sum, t) => sum + (t.metrics?.complaints || 0), 0)
  const avgBounceRate = totalSends > 0 ? (totalBounces / totalSends) * 100 : 0
  const avgComplaintRate = totalSends > 0 ? (totalComplaints / totalSends) * 100 : 0

  // Tenants with issues
  const tenantsWithHighBounce = tenants.filter(t => (t.metrics?.bounceRate || 0) > 5)
  const tenantsWithHighComplaint = tenants.filter(t => (t.metrics?.complaintRate || 0) > 0.1)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenant Management</h1>
          <p className="text-muted-foreground">
            View and monitor SES tenants, domains, and reputation metrics. 
            <span className="text-yellow-600 ml-1">Data is fetched live from AWS (may take a moment).</span>
          </p>
        </div>
        <Button 
          onClick={() => loadData(true)} 
          variant="outline"
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tenants</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              {total}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sends (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              {totalSends.toLocaleString()}
            </div>
            {accountStats && (
              <p className="text-xs text-muted-foreground mt-1">
                Quota: {accountStats.sentLast24Hours.toLocaleString()} / {accountStats.max24HourSend.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card className={avgBounceRate > 5 ? "border-red-200" : avgBounceRate > 2 ? "border-yellow-200" : ""}>
          <CardHeader className="pb-2">
            <CardDescription>Avg Bounce Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              avgBounceRate > 5 ? "text-red-600" : avgBounceRate > 2 ? "text-yellow-600" : "text-green-600"
            )}>
              {avgBounceRate.toFixed(2)}%
            </div>
            {tenantsWithHighBounce.length > 0 && (
              <p className="text-xs text-red-600 mt-1">
                {tenantsWithHighBounce.length} tenant(s) above 5%
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card className={avgComplaintRate > 0.1 ? "border-red-200" : avgComplaintRate > 0.05 ? "border-yellow-200" : ""}>
          <CardHeader className="pb-2">
            <CardDescription>Avg Complaint Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              avgComplaintRate > 0.1 ? "text-red-600" : avgComplaintRate > 0.05 ? "text-yellow-600" : "text-green-600"
            )}>
              {avgComplaintRate.toFixed(3)}%
            </div>
            {tenantsWithHighComplaint.length > 0 && (
              <p className="text-xs text-red-600 mt-1">
                {tenantsWithHighComplaint.length} tenant(s) above 0.1%
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Account Status</CardDescription>
          </CardHeader>
          <CardContent>
            {accountStats ? (
              <div className="flex items-center gap-2">
                {accountStats.sendingEnabled ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className={cn(
                  "font-medium",
                  accountStats.sendingEnabled ? "text-green-600" : "text-red-600"
                )}>
                  {accountStats.enforcementStatus}
                </span>
              </div>
            ) : (
              <Skeleton className="h-6 w-24" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tenants</CardTitle>
              <CardDescription>
                All SES tenants with their domains and 24-hour metrics
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants, users, domains..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[300px]"
                />
              </div>
              <Select 
                value={sortBy} 
                onValueChange={(v) => setSortBy(v as SortField)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created Date</SelectItem>
                  <SelectItem value="tenantName">Tenant Name</SelectItem>
                  <SelectItem value="sends">Sends (24h)</SelectItem>
                  <SelectItem value="bounceRate">Bounce Rate</SelectItem>
                  <SelectItem value="complaintRate">Complaint Rate</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isRefreshing && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Tenant</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Domains</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sends</TableHead>
                  <TableHead className="text-right">Deliveries</TableHead>
                  <TableHead className="text-right">Bounces</TableHead>
                  <TableHead className="text-right">Complaints</TableHead>
                  <TableHead className="text-right">Bounce Rate</TableHead>
                  <TableHead className="text-right">Complaint Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "No tenants match your search" : "No tenants found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((tenant) => (
                    <TableRow key={tenant.id} className={cn(
                      (tenant.metrics?.bounceRate || 0) > 5 || (tenant.metrics?.complaintRate || 0) > 0.1
                        ? "bg-red-50/50"
                        : ""
                    )}>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <div className="font-medium truncate max-w-[180px]">{tenant.tenantName}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                  {tenant.configurationSetName || "No config set"}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>ID: {tenant.id}</p>
                              <p>AWS ID: {tenant.awsTenantId}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="truncate max-w-[150px]">
                          <div className="font-medium">{tenant.userName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{tenant.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {tenant.domains.length === 0 ? (
                            <span className="text-muted-foreground text-sm">No domains</span>
                          ) : tenant.domains.slice(0, 2).map((d) => (
                            <TooltipProvider key={d.domain}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant={d.status === "verified" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    <Globe className="h-3 w-3 mr-1" />
                                    {d.domain.length > 15 ? d.domain.slice(0, 15) + "..." : d.domain}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{d.domain}</p>
                                  <p>Status: {d.status}</p>
                                  <p>Can receive: {d.canReceiveEmails ? "Yes" : "No"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                          {tenant.domains.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{tenant.domains.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(tenant.awsSendingStatus)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(tenant.metrics?.sends || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(tenant.metrics?.deliveries || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(tenant.metrics?.bounces || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(tenant.metrics?.complaints || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {getRateBadge(tenant.metrics?.bounceRate || 0, "bounce")}
                      </TableCell>
                      <TableCell className="text-right">
                        {getRateBadge(tenant.metrics?.complaintRate || 0, "complaint")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {tenants.length} of {total} tenants
            </p>
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


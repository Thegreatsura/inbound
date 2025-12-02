"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, ChevronUp, Search, X, Filter, ArrowUpDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { mockTenants } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

type SortField = "name" | "emailsSent" | "complaintScore" | "bounceScore" | "spamScore" | "plan"
type SortDirection = "asc" | "desc"

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
  if (num >= 1000) return (num / 1000).toFixed(1) + "K"
  return num.toString()
}

function formatPercentage(num: number): string {
  return num.toFixed(2) + "%"
}

function getScoreColor(score: number, type: "complaint" | "bounce" | "spam"): string {
  if (type === "spam") {
    if (score <= 2) return "text-emerald-600"
    if (score <= 5) return "text-amber-600"
    return "text-red-600"
  }
  // For complaint and bounce (percentages)
  if (score <= 1) return "text-emerald-600"
  if (score <= 3) return "text-amber-600"
  return "text-red-600"
}

function getPlanBadgeVariant(plan: string): "default" | "secondary" | "outline" {
  switch (plan) {
    case "enterprise":
      return "default"
    case "business":
      return "secondary"
    default:
      return "outline"
  }
}

export function DataTable() {
  const [search, setSearch] = React.useState("")
  const [expandedTenants, setExpandedTenants] = React.useState<Set<string>>(new Set())
  const [sortField, setSortField] = React.useState<SortField>("emailsSent")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")
  const [planFilter, setPlanFilter] = React.useState<string[]>([])
  const [scoreFilter, setScoreFilter] = React.useState<"all" | "healthy" | "warning" | "critical">("all")

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
    setExpandedTenants(new Set(mockTenants.map((t) => t.id)))
  }

  const collapseAll = () => {
    setExpandedTenants(new Set())
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const filteredAndSortedTenants = React.useMemo(() => {
    let result = [...mockTenants]

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (tenant) =>
          tenant.name.toLowerCase().includes(searchLower) ||
          tenant.accountId.toLowerCase().includes(searchLower) ||
          tenant.identities.some((id) => id.domain.toLowerCase().includes(searchLower)),
      )
    }

    // Plan filter
    if (planFilter.length > 0) {
      result = result.filter((tenant) => planFilter.includes(tenant.plan))
    }

    // Score filter
    if (scoreFilter !== "all") {
      result = result.filter((tenant) => {
        const maxScore = Math.max(tenant.complaintScore * 10, tenant.bounceScore, tenant.spamScore)
        if (scoreFilter === "healthy") return maxScore <= 2
        if (scoreFilter === "warning") return maxScore > 2 && maxScore <= 5
        if (scoreFilter === "critical") return maxScore > 5
        return true
      })
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case "emailsSent":
          aVal = a.totalEmailsSent
          bVal = b.totalEmailsSent
          break
        case "complaintScore":
          aVal = a.complaintScore
          bVal = b.complaintScore
          break
        case "bounceScore":
          aVal = a.bounceScore
          bVal = b.bounceScore
          break
        case "spamScore":
          aVal = a.spamScore
          bVal = b.spamScore
          break
        case "plan":
          const planOrder = { enterprise: 4, business: 3, starter: 2, free: 1 }
          aVal = planOrder[a.plan]
          bVal = planOrder[b.plan]
          break
        default:
          return 0
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return result
  }, [search, planFilter, scoreFilter, sortField, sortDirection])

  const activeFiltersCount = (planFilter.length > 0 ? 1 : 0) + (scoreFilter !== "all" ? 1 : 0)

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      {sortField === field ? (
        sortDirection === "asc" ? (
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
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tenants, accounts, or domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 pr-7 h-8 text-sm rounded-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 bg-transparent h-8 px-2.5 text-xs rounded-sm">
                <Filter className="h-3.5 w-3.5" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-sm"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3 rounded-sm" align="end">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Plan</label>
                  <div className="space-y-1">
                    {["enterprise", "business", "starter", "free"].map((plan) => (
                      <label key={plan} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={planFilter.includes(plan)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPlanFilter([...planFilter, plan])
                            } else {
                              setPlanFilter(planFilter.filter((p) => p !== plan))
                            }
                          }}
                          className="h-3.5 w-3.5 rounded-sm"
                        />
                        <span className="capitalize">{plan}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block">Health Status</label>
                  <Select value={scoreFilter} onValueChange={(v) => setScoreFilter(v as typeof scoreFilter)}>
                    <SelectTrigger className="h-7 text-xs rounded-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-sm">
                      <SelectItem value="all" className="text-xs">
                        All
                      </SelectItem>
                      <SelectItem value="healthy" className="text-xs">
                        Healthy
                      </SelectItem>
                      <SelectItem value="warning" className="text-xs">
                        Warning
                      </SelectItem>
                      <SelectItem value="critical" className="text-xs">
                        Critical
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => {
                      setPlanFilter([])
                      setScoreFilter("all")
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

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

      <div className="text-xs text-muted-foreground mb-1.5">
        {filteredAndSortedTenants.length} tenant{filteredAndSortedTenants.length !== 1 ? "s" : ""}
        {search && ` matching "${search}"`}
      </div>

      <div className="border rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-8"></th>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-[200px]">
                  <SortButton field="name">Tenant</SortButton>
                </th>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-[100px]">
                  <SortButton field="plan">Plan</SortButton>
                </th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[100px]">
                  <SortButton field="emailsSent">Emails Sent</SortButton>
                </th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[90px]">Delivered</th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[90px]">
                  <SortButton field="complaintScore">Complaint</SortButton>
                </th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[80px]">
                  <SortButton field="bounceScore">Bounce</SortButton>
                </th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[70px]">
                  <SortButton field="spamScore">Spam</SortButton>
                </th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[80px]">Identities</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTenants.map((tenant) => (
                <React.Fragment key={tenant.id}>
                  <tr
                    className={cn(
                      "border-b hover:bg-muted/30 cursor-pointer transition-colors",
                      expandedTenants.has(tenant.id) && "bg-muted/20",
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
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{tenant.accountId}</div>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <Badge
                        variant={getPlanBadgeVariant(tenant.plan)}
                        className="capitalize text-[10px] px-1.5 py-0 rounded-sm"
                      >
                        {tenant.plan}
                      </Badge>
                    </td>
                    <td className="px-2 py-1 text-right font-mono">{formatNumber(tenant.totalEmailsSent)}</td>
                    <td className="px-2 py-1 text-right font-mono">{formatNumber(tenant.totalEmailsDelivered)}</td>
                    <td
                      className={cn(
                        "px-2 py-1 text-right font-mono",
                        getScoreColor(tenant.complaintScore, "complaint"),
                      )}
                    >
                      {formatPercentage(tenant.complaintScore)}
                    </td>
                    <td className={cn("px-2 py-1 text-right font-mono", getScoreColor(tenant.bounceScore, "bounce"))}>
                      {formatPercentage(tenant.bounceScore)}
                    </td>
                    <td className={cn("px-2 py-1 text-right font-mono", getScoreColor(tenant.spamScore, "spam"))}>
                      {tenant.spamScore.toFixed(1)}
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">{tenant.identities.length}</td>
                  </tr>

                  {/* Expanded identities */}
                  {expandedTenants.has(tenant.id) &&
                    tenant.identities.map((identity, idx) => (
                      <tr
                        key={identity.id}
                        className={cn(
                          "bg-muted/10 text-muted-foreground",
                          idx === tenant.identities.length - 1 ? "border-b" : "",
                        )}
                      >
                        <td className="px-2 py-1"></td>
                        <td className="px-2 py-1 pl-6">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground/60">└</span>
                            <span className="font-mono text-foreground">{identity.domain}</span>
                            <Badge
                              variant={identity.status === "verified" ? "outline" : "secondary"}
                              className="text-[10px] px-1 py-0 rounded-sm"
                            >
                              {identity.status}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-2 py-1"></td>
                        <td className="px-2 py-1 text-right font-mono">{formatNumber(identity.emailsSent)}</td>
                        <td className="px-2 py-1 text-right font-mono">{formatNumber(identity.emailsDelivered)}</td>
                        <td className="px-2 py-1 text-right font-mono">{identity.complaints.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right font-mono">{identity.bounces.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right font-mono">—</td>
                        <td className="px-2 py-1 text-right text-[10px]">
                          {new Date(identity.lastActivity).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              ))}

              {filteredAndSortedTenants.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">
                    No tenants found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

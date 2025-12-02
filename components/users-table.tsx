"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, Search, X, Filter, ArrowUpDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { mockUsers } from "@/lib/mock-users"
import { cn } from "@/lib/utils"

type SortField = "name" | "email" | "tenant" | "emailsSent" | "role" | "status" | "lastActive"
type SortDirection = "asc" | "desc"

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
  if (num >= 1000) return (num / 1000).toFixed(1) + "K"
  return num.toString()
}

function getRoleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  switch (role) {
    case "admin":
      return "default"
    case "member":
      return "secondary"
    default:
      return "outline"
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "text-emerald-600"
    case "invited":
      return "text-amber-600"
    case "suspended":
      return "text-red-600"
    default:
      return ""
  }
}

export function UsersTable() {
  const [search, setSearch] = React.useState("")
  const [sortField, setSortField] = React.useState<SortField>("emailsSent")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")
  const [roleFilter, setRoleFilter] = React.useState<string[]>([])
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const filteredAndSortedUsers = React.useMemo(() => {
    let result = [...mockUsers]

    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (user) =>
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          user.tenantName.toLowerCase().includes(searchLower),
      )
    }

    if (roleFilter.length > 0) {
      result = result.filter((user) => roleFilter.includes(user.role))
    }

    if (statusFilter !== "all") {
      result = result.filter((user) => user.status === statusFilter)
    }

    result.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case "email":
          aVal = a.email.toLowerCase()
          bVal = b.email.toLowerCase()
          break
        case "tenant":
          aVal = a.tenantName.toLowerCase()
          bVal = b.tenantName.toLowerCase()
          break
        case "emailsSent":
          aVal = a.emailsSent
          bVal = b.emailsSent
          break
        case "role":
          const roleOrder = { admin: 3, member: 2, viewer: 1 }
          aVal = roleOrder[a.role]
          bVal = roleOrder[b.role]
          break
        case "status":
          const statusOrder = { active: 3, invited: 2, suspended: 1 }
          aVal = statusOrder[a.status]
          bVal = statusOrder[b.status]
          break
        case "lastActive":
          aVal = new Date(a.lastActive).getTime()
          bVal = new Date(b.lastActive).getTime()
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
  }, [search, roleFilter, statusFilter, sortField, sortDirection])

  const activeFiltersCount = (roleFilter.length > 0 ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search users, emails, or tenants..."
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
                  <label className="text-xs font-medium mb-1.5 block">Role</label>
                  <div className="space-y-1">
                    {["admin", "member", "viewer"].map((role) => (
                      <label key={role} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={roleFilter.includes(role)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setRoleFilter([...roleFilter, role])
                            } else {
                              setRoleFilter(roleFilter.filter((r) => r !== role))
                            }
                          }}
                          className="h-3.5 w-3.5 rounded-sm"
                        />
                        <span className="capitalize">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-7 text-xs rounded-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-sm">
                      <SelectItem value="all" className="text-xs">
                        All
                      </SelectItem>
                      <SelectItem value="active" className="text-xs">
                        Active
                      </SelectItem>
                      <SelectItem value="invited" className="text-xs">
                        Invited
                      </SelectItem>
                      <SelectItem value="suspended" className="text-xs">
                        Suspended
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
                      setRoleFilter([])
                      setStatusFilter("all")
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-1.5">
        {filteredAndSortedUsers.length} user{filteredAndSortedUsers.length !== 1 ? "s" : ""}
        {search && ` matching "${search}"`}
      </div>

      <div className="border rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-[180px]">
                  <SortButton field="name">Name</SortButton>
                </th>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-[200px]">
                  <SortButton field="email">Email</SortButton>
                </th>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-[160px]">
                  <SortButton field="tenant">Tenant</SortButton>
                </th>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-[80px]">
                  <SortButton field="role">Role</SortButton>
                </th>
                <th className="text-left font-medium text-muted-foreground px-2 py-1.5 w-[80px]">
                  <SortButton field="status">Status</SortButton>
                </th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[100px]">
                  <SortButton field="emailsSent">Emails Sent</SortButton>
                </th>
                <th className="text-right font-medium text-muted-foreground px-2 py-1.5 w-[100px]">
                  <SortButton field="lastActive">Last Active</SortButton>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.map((user) => (
                <tr key={user.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-2 py-1 font-medium">{user.name}</td>
                  <td className="px-2 py-1 font-mono text-muted-foreground">{user.email}</td>
                  <td className="px-2 py-1">{user.tenantName}</td>
                  <td className="px-2 py-1">
                    <Badge
                      variant={getRoleBadgeVariant(user.role)}
                      className="capitalize text-[10px] px-1.5 py-0 rounded-sm"
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td className={cn("px-2 py-1 capitalize", getStatusColor(user.status))}>{user.status}</td>
                  <td className="px-2 py-1 text-right font-mono">{formatNumber(user.emailsSent)}</td>
                  <td className="px-2 py-1 text-right text-muted-foreground">
                    {new Date(user.lastActive).toLocaleDateString()}
                  </td>
                </tr>
              ))}

              {filteredAndSortedUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    No users found matching your criteria.
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

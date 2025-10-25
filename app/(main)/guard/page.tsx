"use client"

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import Link from 'next/link'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useGuardRulesQuery } from '@/features/guard/hooks/useGuardHooks'

// Import Nucleo icons
import CirclePlus from '@/components/icons/circle-plus'
import Refresh2 from '@/components/icons/refresh-2'
import CircleXmark from '@/components/icons/circle-xmark'
import Magnifier2 from '@/components/icons/magnifier-2'
import Filter2 from '@/components/icons/filter-2'
import BoltLightning from '@/components/icons/bolt-lightning'
import Code2 from '@/components/icons/code-2'
import SidebarToggleButton from '@/components/sidebar-toggle-button'
import { ApiIdLabel } from '@/components/api-id-label'
import ThreeWayArrowSplit from '@/components/icons/three-way-arrow-split'
import AddMagic from '@/components/icons/add-magic'

export default function GuardPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Debounce inputs
  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  const debouncedType = useDebouncedValue(typeFilter, 150)
  const debouncedStatus = useDebouncedValue(statusFilter, 150)

  // Fetch rules
  const {
    data: rulesResponse,
    isLoading,
    error,
    refetch: refetchRules
  } = useGuardRulesQuery({
    search: debouncedSearch || undefined,
    type: debouncedType !== 'all' ? (debouncedType as 'explicit' | 'ai_prompt') : undefined,
    isActive: debouncedStatus !== 'all' ? debouncedStatus === 'active' : undefined,
    limit: 100,
  })

  const rules = rulesResponse?.data || []

  // Helper
  const getRuleTypeIcon = (type: string) => (type === 'explicit' ? ThreeWayArrowSplit : AddMagic)

  // Error state
  if (error) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6">
            <div className="flex items-center gap-2 text-destructive">
              <CircleXmark width="16" height="16" />
              <span>{error.message}</span>
              <Button variant="ghost" size="sm" onClick={() => refetchRules()} className="ml-auto text-destructive hover:text-destructive/80">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
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
                  Guard Rules
                </h2>
                <p className="text-muted-foreground text-sm font-medium">
                  {rulesResponse?.pagination.total || 0} rules configured
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="default" asChild>
                <Link href="/guard/rules/create">
                  <CirclePlus width="12" height="12" className="mr-1" />
                  Create Rule
                </Link>
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={() => refetchRules()}
                disabled={isLoading}
              >
                <Refresh2 width="14" height="14" className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Magnifier2 width="16" height="16" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 rounded-xl"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="explicit">Explicit</SelectItem>
                <SelectItem value="ai_prompt">AI Prompt</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setTypeFilter('all')
                  setStatusFilter('all')
                }}
                className="h-8"
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Rules List */}
      <div className="max-w-5xl mx-auto p-2 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground">Loading rules...</div>
          </div>
        ) : !rules.length ? (
          <div className="max-w-5xl mx-auto">
            <div className="bg-card border-border rounded-xl p-8">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2 text-foreground">No rules found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your filters or search query.'
                    : 'Start by creating a rule to filter your emails.'}
                </p>
                <Button variant="secondary" asChild>
                  <Link href="/guard/rules/create">
                    <CirclePlus width="16" height="16" className="mr-2" />
                    Create Your First Rule
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-border rounded-[13px] bg-card">
            {rules.map((rule) => {
              const RuleIcon = getRuleTypeIcon(rule.type)
              
              return (
                <Link
                  key={rule.id}
                  href={`/guard/rules/${rule.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors cursor-pointer hover:bg-muted/50"
                >
                  {/* Rule Icon with Status */}
                  <div className="flex-shrink-0">
                    <div className="relative p-[8px] rounded-md bg-muted">
                      <RuleIcon 
                        width="23" 
                        height="23" 
                        fill="var(--purple-primary)"
                        secondaryfill="var(--purple-primary)"
                      />
                      <div className="absolute -top-1 -right-1">
                        <div className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-600 dark:bg-green-500' : 'bg-muted-foreground'}`} />
                      </div>
                    </div>
                  </div>

                  {/* Rule Info */}
                  <div className="flex-shrink-0 w-100 flex flex-col gap-[2px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{rule.name}</span>
                      <Badge variant={rule.type === 'explicit' ? 'secondary' : 'default'}>
                        {rule.type === 'explicit' ? 'Explicit' : 'AI'}
                      </Badge>
                      {/* <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge> */}
                    </div>

                    <ApiIdLabel id={rule.id} size="sm" />

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Priority: {rule.priority}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        Triggers: {rule.triggerCount || 0}
                      </span>
                      {rule.lastTriggeredAt && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            Last: {format(new Date(rule.lastTriggeredAt), 'MMM d')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Created Date */}
                  <div className="flex-shrink-0 text-xs text-muted-foreground w-20 text-right ml-auto">
                    {rule.createdAt ? format(rule.createdAt, 'MMM d') : '—'}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


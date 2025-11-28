"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useEndpointsInfiniteQuery, flattenEndpointPages } from "@/features/endpoints/hooks"
import type { EndpointWithStats } from "@/features/endpoints/types"

// Icons
import BoltLightning from "@/components/icons/bolt-lightning"
import Envelope2 from "@/components/icons/envelope-2"
import UserGroup from "@/components/icons/user-group"
import DoubleChevronDown from "@/components/icons/double-chevron-down"
import Check2 from "@/components/icons/check-2"
import Loader from "@/components/icons/loader"
import CirclePlus from "@/components/icons/circle-plus"

export type EndpointSelectorProps = {
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  filterActive?: boolean
  filterType?: 'webhook' | 'email' | 'email_group'
  allowNone?: boolean
  noneLabel?: string
  showCreateNew?: boolean
  onCreateNew?: () => void
  className?: string
}

function getEndpointIcon(type: string) {
  switch (type) {
    case 'webhook':
      return BoltLightning
    case 'email':
      return Envelope2
    case 'email_group':
      return UserGroup
    default:
      return Envelope2
  }
}

function getEndpointIconColor(endpoint: EndpointWithStats | null) {
  if (!endpoint?.isActive) return "hsl(var(--muted-foreground))"

  switch (endpoint?.type) {
    case 'webhook':
      return "#8b5cf6"
    case 'email':
      return "#3b82f6"
    case 'email_group':
      return "#10b981"
    default:
      return "hsl(var(--muted-foreground))"
  }
}

function getEndpointTypeLabel(type: string) {
  switch (type) {
    case 'webhook':
      return 'Webhook'
    case 'email':
      return 'Email Forward'
    case 'email_group':
      return 'Email Group'
    default:
      return type
  }
}

export function EndpointSelector({
  value,
  onChange,
  placeholder = "Select an endpoint...",
  disabled = false,
  filterActive = true,
  filterType,
  allowNone = false,
  noneLabel = "None",
  showCreateNew = false,
  onCreateNew,
  className,
}: EndpointSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search, 300)
  const listRef = React.useRef<HTMLDivElement>(null)
  const loadMoreRef = React.useRef<HTMLDivElement>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useEndpointsInfiniteQuery({
    search: debouncedSearch || undefined,
    type: filterType,
    active: filterActive ? true : undefined,
    limit: 20,
  })

  const endpoints = React.useMemo(() => {
    const all = flattenEndpointPages(data?.pages)
    // Apply client-side active filter if needed
    return filterActive ? all.filter(e => e.isActive) : all
  }, [data?.pages, filterActive])

  // Find selected endpoint for display
  const selectedEndpoint = React.useMemo(() => {
    if (!value) return null
    return endpoints.find(e => e.id === value) || null
  }, [value, endpoints])

  // Infinite scroll with IntersectionObserver
  React.useEffect(() => {
    const loadMoreElement = loadMoreRef.current
    if (!loadMoreElement) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      {
        root: listRef.current,
        rootMargin: "100px",
        threshold: 0.1,
      }
    )

    observer.observe(loadMoreElement)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  // Reset search when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearch("")
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          {selectedEndpoint ? (
            <div className="flex items-center gap-2 truncate">
              {(() => {
                const Icon = getEndpointIcon(selectedEndpoint.type)
                return (
                  <Icon
                    width="16"
                    height="16"
                    style={{ color: getEndpointIconColor(selectedEndpoint) }}
                    className="flex-shrink-0"
                  />
                )
              })()}
              <span className="truncate">{selectedEndpoint.name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                ({getEndpointTypeLabel(selectedEndpoint.type)})
              </span>
            </div>
          ) : value === null && allowNone ? (
            <span>{noneLabel}</span>
          ) : (
            <span>{isLoading ? "Loading..." : placeholder}</span>
          )}
          <DoubleChevronDown
            width="16"
            height="16"
            className="ml-2 h-4 w-4 shrink-0 opacity-50"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search endpoints..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList ref={listRef} className="max-h-[300px]">
            <CommandEmpty>
              {isLoading ? "Loading..." : "No endpoints found."}
            </CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                  className="px-3 py-2.5"
                >
                  <Check2
                    width="16"
                    height="16"
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === null ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">{noneLabel}</span>
                </CommandItem>
              )}
              {showCreateNew && (
                <CommandItem
                  value="__create_new__"
                  onSelect={() => {
                    setOpen(false)
                    onCreateNew?.()
                  }}
                  className="px-3 py-2.5"
                >
                  <CirclePlus
                    width="16"
                    height="16"
                    className="mr-2 h-4 w-4 text-primary"
                  />
                  <span className="text-primary font-medium">Create New Endpoint</span>
                </CommandItem>
              )}
              {endpoints.map((endpoint) => {
                const Icon = getEndpointIcon(endpoint.type)
                const isSelected = value === endpoint.id
                return (
                  <CommandItem
                    key={endpoint.id}
                    value={`${endpoint.id}-${endpoint.name}`}
                    onSelect={() => {
                      onChange(endpoint.id)
                      setOpen(false)
                    }}
                    className="px-3 py-2.5"
                  >
                    <Check2
                      width="16"
                      height="16"
                      className={cn(
                        "mr-2 h-4 w-4 flex-shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Icon
                        width="16"
                        height="16"
                        style={{ color: getEndpointIconColor(endpoint) }}
                        className="flex-shrink-0"
                      />
                      <span className="truncate">{endpoint.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({getEndpointTypeLabel(endpoint.type)})
                      </span>
                    </div>
                  </CommandItem>
                )
              })}
              {/* Load more trigger */}
              <div ref={loadMoreRef} className="h-1" />
              {isFetchingNextPage && (
                <div className="flex items-center justify-center py-2">
                  <Loader width="16" height="16" className="animate-spin text-muted-foreground" />
                </div>
              )}
              {hasNextPage && !isFetchingNextPage && endpoints.length > 0 && (
                <div className="text-xs text-center text-muted-foreground py-2">
                  Scroll for more...
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

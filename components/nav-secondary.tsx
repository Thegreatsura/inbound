"use client"

import * as React from "react"
import { OptimizedLink } from "@/components/optimized-link"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavigationItem, isNavigationItemActive } from "@/lib/navigation"
import { useNavigation } from "@/contexts/navigation-context"

export function NavSecondary({
  items,
  ...props
}: {
  items: NavigationItem[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { currentPath } = useNavigation()
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = isNavigationItemActive(item.url, currentPath)
            // Check if we're on a sub-page (e.g., /admin/tenant/123 when item.url is /admin/tenant)
            const isOnSubPage = isActive && currentPath !== item.url
            
            return (
              <SidebarMenuItem key={item.title}>
                {isActive && !isOnSubPage ? (
                  // Exact match - non-clickable active state
                  <SidebarMenuButton 
                    tooltip={item.title}
                    isActive={true}
                    className="cursor-default"
                  >
                    {item.icon && <item.icon className="h-4 w-4" />}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                ) : isOnSubPage ? (
                  // On sub-page - clickable to go back to root
                  <SidebarMenuButton 
                    asChild 
                    tooltip={`Back to ${item.title}`}
                    isActive={true}
                  >
                    <OptimizedLink href={item.url} className="flex items-center gap-2">
                      {item.icon && <item.icon className="h-4 w-4" />}
                      <span>{item.title}</span>
                    </OptimizedLink>
                  </SidebarMenuButton>
                ) : (
                  // Not active - normal link
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title}
                    isActive={false}
                  >
                    <OptimizedLink href={item.url} className="flex items-center gap-2">
                      {item.icon && (
                        <item.icon className="h-4 w-4 opacity-60" />
                      )}
                      <span className="opacity-60">{item.title}</span>
                    </OptimizedLink>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

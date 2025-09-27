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
            return (
              <SidebarMenuItem key={item.title}>
                {isActive ? (
                  <SidebarMenuButton 
                    tooltip={item.title}
                    isActive={true}
                    className="cursor-default opacity-80"
                  >
                    {item.icon && <item.icon className="h-4 w-4 opacity-80" />}
                    <span className="opacity-80">{item.title}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title}
                    isActive={false}
                  >
                    <OptimizedLink href={item.url} className="flex items-center gap-2">
                      {item.icon && (
                        <item.icon
                          className="h-4 w-4 opacity-50 text-black dark:text-white"
                        />
                      )}
                      <span className="opacity-50 text-black dark:text-white">{item.title}</span>
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

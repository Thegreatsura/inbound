"use client"

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
import { signOut } from "@/lib/auth/auth-client"
import DoorOpen from "@/components/icons/door-open"

export function NavMain({
  items,
}: {
  items: NavigationItem[]
}) {
  const { currentPath } = useNavigation()

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/"
        }
      }
    })
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const isActive = isNavigationItemActive(item.url, currentPath)
            // Check if we're on a sub-page (e.g., /logs/123 when item.url is /logs)
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
                    tooltip={`Back to ${item.title}`}
                    asChild 
                    isActive={true}
                  >
                    <OptimizedLink href={item.url}>
                      {item.icon && <item.icon className="h-4 w-4" />}
                      <span>{item.title}</span>
                    </OptimizedLink>
                  </SidebarMenuButton>
                ) : (
                  // Not active - normal link
                  <SidebarMenuButton 
                    tooltip={item.title} 
                    asChild 
                    isActive={false}
                  >
                    <OptimizedLink href={item.url}>
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
          <SidebarMenuItem>
            <SidebarMenuButton 
              tooltip="Sign Out"
              onClick={handleSignOut}
              className="text-red-500 hover:!bg-red-500/20 hover:text-red-500"
            >
              <DoorOpen className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

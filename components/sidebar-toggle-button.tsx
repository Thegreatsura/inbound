"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/ui/sidebar"
import SidebarToggleIcon from "@/components/icons/sidebar-toggle"

type SidebarToggleButtonProps = React.ComponentProps<typeof Button>

export function SidebarToggleButton({ className, ...props }: SidebarToggleButtonProps) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle sidebar"
      onClick={() => toggleSidebar()}
      className={cn("h-8 w-8", className)}
      {...props}
      >
      <SidebarToggleIcon className="!h-[22px] !w-[22px]" />
    </Button>
  )
}

export default SidebarToggleButton



"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/admin/tenant", label: "Tenants" },
  { href: "/admin/users", label: "Users" },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 mb-3">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "px-2 py-1 text-xs rounded-sm transition-colors",
            pathname === item.href
              ? "bg-foreground text-background font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

"use client"
import * as React from "react"

type UserAvatarProps = {
  name?: string
  email?: string
  width?: number
  height?: number
  className?: string
  font?: "Geist" | "Inter" | "Outfit"
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      // First letter of first name + first letter of last name
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    // Single name - take first 2 characters
    return name.substring(0, 2).toUpperCase()
  }
  
  if (email) {
    // Use first 2 characters of email
    return email.substring(0, 2).toUpperCase()
  }
  
  return "U"
}

export default function UserAvatar({
  name,
  email,
  width = 100,
  height = 100,
  className,
  font = "Outfit",
}: UserAvatarProps) {
  const initials = React.useMemo(() => getInitials(name, email), [name, email])
  const fontSize = React.useMemo(() => Math.floor(height * 0.4), [height])
  
  const avatarUrl = React.useMemo(() => {
    const params = new URLSearchParams({
      text: initials,
      width: (width * 4).toString(),
      height: (height * 4).toString(),
      fontSize: (fontSize * 4).toString(),
      font: font,
    })
    return `https://useravatar.vercel.app/api/logo?${params.toString()}`
  }, [initials, width, height, fontSize, font])

  return (
    <img
      src={avatarUrl}
      alt={name || email || "User avatar"}
      width={width}
      height={height}
      className={className}
      loading="lazy"
    />
  )
}



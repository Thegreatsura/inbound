"use client"

import { DotLottiePlayer } from "@dotlottie/react-player"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
  text?: string
  textClassName?: string
}

const sizeMap = {
  sm: { width: 32, height: 32 },
  md: { width: 48, height: 48 },
  lg: { width: 64, height: 64 },
  xl: { width: 96, height: 96 }
}

export function LoadingSpinner({ 
  size = "md", 
  className, 
  text,
  textClassName 
}: LoadingSpinnerProps) {
  const dimensions = sizeMap[size]
  
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <DotLottiePlayer
        src="/inbound.lottie"
        style={dimensions}
        autoplay={true}
        loop={true}
        className="pointer-events-none"
      />
      {text && (
        <p className={cn(
          "text-sm text-muted-foreground animate-pulse",
          textClassName
        )}>
          {text}
        </p>
      )}
    </div>
  )
}

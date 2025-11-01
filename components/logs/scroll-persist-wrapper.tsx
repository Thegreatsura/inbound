"use client"

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const SCROLL_STORAGE_KEY = 'logs-page-scroll'

export function ScrollPersistWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isRestoringRef = useRef(false)

  // Save scroll position continuously
  useEffect(() => {
    const handleScroll = () => {
      if (isRestoringRef.current) return
      
      const scrollY = window.scrollY
      sessionStorage.setItem(SCROLL_STORAGE_KEY, scrollY.toString())
    }

    // Throttle scroll events for better performance
    let timeoutId: NodeJS.Timeout | null = null
    const throttledHandleScroll = () => {
      if (timeoutId) return
      timeoutId = setTimeout(() => {
        handleScroll()
        timeoutId = null
      }, 100)
    }

    window.addEventListener('scroll', throttledHandleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  // Save scroll position before navigation (capture on link clicks)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const scrollY = window.scrollY
      sessionStorage.setItem(SCROLL_STORAGE_KEY, scrollY.toString())
    }

    // Listen for link clicks to save scroll position immediately
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href^="/logs/"]')
      if (link) {
        handleBeforeUnload()
      }
    }

    document.addEventListener('click', handleClick, true)
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Restore scroll position on navigation
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const restoreScroll = () => {
      isRestoringRef.current = true
      const savedScroll = sessionStorage.getItem(SCROLL_STORAGE_KEY)
      
      if (savedScroll !== null) {
        const scrollY = parseInt(savedScroll, 10)
        // Use requestAnimationFrame to ensure the scroll happens after render
        requestAnimationFrame(() => {
          window.scrollTo({
            top: scrollY,
            behavior: 'instant' // Instant to avoid animation during restoration
          })
          // Allow scroll saving again after a short delay
          setTimeout(() => {
            isRestoringRef.current = false
          }, 100)
        })
      } else {
        isRestoringRef.current = false
      }
    }

    // Small delay to ensure page content has rendered
    const timeoutId = setTimeout(restoreScroll, 0)
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [pathname])

  return <>{children}</>
}

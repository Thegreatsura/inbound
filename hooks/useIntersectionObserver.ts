"use client"

import { useEffect, useRef, useState } from "react"

export function useIntersectionObserver(options = {}) {
  const [hasIntersected, setHasIntersected] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Emit a one-shot pulse when the element ENTERS the viewport
        if (entry.isIntersecting) {
          setHasIntersected(true)
          // Immediately reset to false so consumers only act once per intersection
          // and require the element to leave and re-enter to trigger again.
          Promise.resolve().then(() => setHasIntersected(false))
        }
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
        ...options,
      },
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) observer.unobserve(ref.current)
      observer.disconnect()
    }
  }, [options])

  return { ref, hasIntersected }
}

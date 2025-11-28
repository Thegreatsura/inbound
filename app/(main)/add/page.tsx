"use client"

import { useState, useEffect, useRef, useCallback, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { track } from "@vercel/analytics"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { client } from "@/lib/api/client"
import { validateDomain, type DomainValidationResult } from "@/lib/domains-and-dns/validate-domain"
import Loader from "@/components/icons/loader"
import ArrowBoldRight from "@/components/icons/arrow-bold-right"
import CircleCheck from "@/components/icons/circle-check"
import CircleWarning2 from "@/components/icons/circle-warning-2"
import { cn } from "@/lib/utils"

type ValidationState = "idle" | "checking" | "valid" | "invalid"

export default function AddDomainPage() {
  const [domainName, setDomainName] = useState("")
  const [validationState, setValidationState] = useState<ValidationState>("idle")
  const [validationResult, setValidationResult] = useState<DomainValidationResult | null>(null)
  const [apiError, setApiError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  
  // Ref to track the latest input value for debouncing
  const latestValueRef = useRef("")
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced validation
  const validateDomainDebounced = useCallback((value: string) => {
    // Clear any pending validation
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const trimmedValue = value.trim()
    latestValueRef.current = trimmedValue

    // If empty, reset to idle
    if (!trimmedValue) {
      setValidationState("idle")
      setValidationResult(null)
      return
    }

    // Show checking state
    setValidationState("checking")

    // Debounce: wait 350ms before validating
    debounceTimerRef.current = setTimeout(() => {
      // Only validate if this is still the latest value
      if (latestValueRef.current === trimmedValue) {
        const result = validateDomain(trimmedValue)
        setValidationResult(result)
        setValidationState(result.isValid ? "valid" : "invalid")
      }
    }, 350)
  }, [])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDomainName(value)
    setApiError("") // Clear API errors on new input
    validateDomainDebounced(value)
  }

  // Handle keyboard shortcut (Cmd/Ctrl + Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (canSubmit) {
        handleSubmit(e as unknown as FormEvent)
      }
    }
  }

  const canSubmit = validationState === "valid" && !isLoading

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!canSubmit) return

    const domain = validationResult?.normalizedDomain || domainName.trim().toLowerCase()

    setIsLoading(true)
    setApiError("")

    try {
      const { data, error: apiError, status } = await client.api.e2.domains.post({ domain })

      // Check for error response (either apiError or data contains error)
      if (apiError || !data || "error" in data) {
        // Handle error responses
        let errorMessage = "Failed to add domain"
        
        if (apiError && typeof apiError === "object" && "error" in apiError) {
          errorMessage = (apiError as { error: string }).error
        } else if (data && "error" in data) {
          errorMessage = (data as { error: string }).error
        }
        
        if (status === 409) {
          setApiError(errorMessage || "This domain already exists.")
        } else if (status === 403) {
          setApiError(errorMessage || "Domain limit reached. Please upgrade your plan.")
        } else {
          setApiError(errorMessage)
        }
        return
      }

      // At this point, data is the success response with id
      const domainId = data.id

      // Track successful domain addition
      track("Domain Added", {
        domain: domain,
        domainId: domainId,
      })

      toast.success("Domain added successfully!")
      router.push(`/emails/${domainId}`)
    } catch (err) {
      console.error("Error adding domain:", err)
      setApiError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Get the display error (validation error or API error)
  const displayError = apiError || (validationState === "invalid" ? validationResult?.error : null)

  return (
    <div className="flex items-center justify-center min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md px-4"
      >
        <h1 className="mb-1 text-lg font-semibold text-foreground">
          Add Domain
        </h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Let&apos;s get you sending and receiving emails with ease.
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="domainName"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Domain
          </label>
          
          <div className="relative">
            <Input
              id="domainName"
              type="text"
              value={domainName}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="example.com"
              className={cn(
                "w-full font-mono text-sm pr-10",
                validationState === "valid" && !apiError && "border-green-500 focus-visible:ring-green-500/20",
                (validationState === "invalid" || apiError) && "border-red-500 focus-visible:ring-red-500/20"
              )}
              aria-label="Domain Name"
              aria-invalid={validationState === "invalid"}
              aria-describedby={displayError ? "domain-error" : undefined}
              disabled={isLoading}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            
            {/* Validation status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AnimatePresence mode="wait">
                {validationState === "checking" && (
                  <motion.div
                    key="checking"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Loader
                      width="16"
                      height="16"
                      className="animate-spin text-muted-foreground"
                    />
                  </motion.div>
                )}
                {validationState === "valid" && !apiError && (
                  <motion.div
                    key="valid"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <CircleCheck
                      width="16"
                      height="16"
                      className="text-green-600"
                    />
                  </motion.div>
                )}
                {(validationState === "invalid" || apiError) && (
                  <motion.div
                    key="invalid"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <CircleWarning2
                      width="16"
                      height="16"
                      className="text-red-500"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="mt-4 w-full"
            disabled={!canSubmit}
          >
            {isLoading ? (
              <>
                <Loader
                  width="16"
                  height="16"
                  className="mr-2 animate-spin"
                />
                Adding domain...
              </>
            ) : (
              <>
                Add Domain
                <ArrowBoldRight
                  width="16"
                  height="16"
                  className="ml-1.5"
                />
              </>
            )}
          </Button>

          {/* Footer area: error/subdomain left, hotkey right */}
          <div className="mt-3 h-5 flex items-center justify-between">
            {/* Left side: error or subdomain hint */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {displayError ? (
                  <motion.p
                    key="error"
                    id="domain-error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-destructive truncate"
                  >
                    {displayError}
                  </motion.p>
                ) : validationState === "valid" && validationResult?.isSubdomain ? (
                  <motion.p
                    key="subdomain-hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-muted-foreground truncate"
                  >
                    Subdomain of {validationResult.rootDomain}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
            
            {/* Right side: hotkey hint (always visible, dimmed when disabled) */}
            <p 
              className={cn(
                "text-xs text-muted-foreground flex-shrink-0 ml-3 transition-opacity duration-150",
                !canSubmit && "opacity-40"
              )}
            >
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border">⌘</kbd>
              {" + "}
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border">Enter</kbd>
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

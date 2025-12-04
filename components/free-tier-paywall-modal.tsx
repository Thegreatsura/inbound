"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { useAutumn, useCustomer } from "autumn-js/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Loader from "@/components/icons/loader"
import CircleCheck from "@/components/icons/circle-check"
import Envelope2 from "@/components/icons/envelope-2"

const UPGRADE_PRODUCT_ID = "inbound_default_test"
const FREE_TIER_PRODUCT_ID = "free_tier"

// Pages where the blocking paywall should NOT appear
const PAYWALL_EXCLUDED_PATHS = ["/onboarding", "/settings"]

export function FreeTierPaywallModal() {
  const pathname = usePathname()
  const { customer, isLoading: isCustomerLoading } = useCustomer()
  const { attach } = useAutumn()
  const [isUpgrading, setIsUpgrading] = useState(false)

  // Determine if user is on free tier
  const isFreeTier = customer?.products?.some(
    (p: { id: string; status: string }) =>
      p.id === FREE_TIER_PRODUCT_ID &&
      (p.status === "active" || p.status === "trialing")
  )

  // Check if user has any paid plan (not free tier)
  const hasPaidPlan = customer?.products?.some(
    (p: { id: string; status: string }) =>
      p.id !== FREE_TIER_PRODUCT_ID &&
      (p.status === "active" || p.status === "trialing")
  )

  // Check if current path is excluded from paywall
  const isExcludedPath = PAYWALL_EXCLUDED_PATHS.some(path => pathname?.startsWith(path))

  // Show modal only if user is on free tier, doesn't have a paid plan, and not on excluded paths
  const shouldShowPaywall = isFreeTier && !hasPaidPlan && !isCustomerLoading && !isExcludedPath

  const handleUpgrade = async () => {
    setIsUpgrading(true)
    try {
      const result = await attach({
        productId: UPGRADE_PRODUCT_ID,
        successUrl: `${window.location.origin}${window.location.pathname}?upgrade=true`,
      }) as any

      // If attach returns a checkoutUrl, redirect manually
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }
      if (result?.data?.checkoutUrl) {
        window.location.href = result.data.checkoutUrl
        return
      }
      
      // If no redirect happened, the upgrade was processed (user has payment method on file)
      // Refresh the page to reflect the new subscription
      window.location.reload()
    } catch (error) {
      console.error("Failed to upgrade:", error)
      setIsUpgrading(false)
    }
    // Note: Don't reset isUpgrading if redirect is happening - keeps button in loading state
  }

  if (!shouldShowPaywall) {
    return null
  }

  return (
    <>
      {/* Overlay that only covers the content area (inside SidebarInset) */}
      <div className="absolute inset-0 z-40 bg-background/80 rounded-lg backdrop-blur-sm p-4" />
      
      {/* Card positioned in the center of the content area */}
      <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
        <Card className="relative w-full max-w-md mx-4 pointer-events-auto shadow-xl border">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Envelope2 width="28" height="28" className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                We&apos;ve Retired the Free Plan
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                To keep Inbound sustainable, we&apos;ve replaced our free tier with an affordable $4/month Starter plan. Upgrade now to continue using Inbound.
              </p>
            </div>

            <div className="space-y-3 py-4 border-t border-b">
              <h4 className="text-sm font-medium text-foreground">What&apos;s included:</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <CircleCheck width="16" height="16" className="text-green-600 flex-shrink-0" />
                  <span className="text-muted-foreground">5,000 emails/month (send &amp; receive)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CircleCheck width="16" height="16" className="text-green-600 flex-shrink-0" />
                  <span className="text-muted-foreground">7-day email retention</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CircleCheck width="16" height="16" className="text-green-600 flex-shrink-0" />
                  <span className="text-muted-foreground">1 custom domain included</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CircleCheck width="16" height="16" className="text-green-600 flex-shrink-0" />
                  <span className="text-muted-foreground">Production-ready infrastructure</span>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <Button
                onClick={handleUpgrade}
                disabled={isUpgrading}
                className="w-full"
                size="lg"
              >
                {isUpgrading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Upgrade for $4/month'
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Cancel anytime. No long-term commitment.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

"use client"

import { useEffect, useState } from 'react'
import { useAutumn } from "autumn-js/react"
import { useSession } from "@/lib/auth/auth-client"
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getAutumnCustomer } from '@/app/actions/primary'
import { MarketingNav, MarketingFooter } from '@/components/marketing-nav'
import { PricingTable, plans } from '@/components/pricing-table'

export default function PricingPage() {
  const { data: session } = useSession()
  const { attach } = useAutumn()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)

  const handlePlanSelection = async (plan: typeof plans[0]) => {
    if (!session?.user) {
      router.push('/login')
      return
    }

    if (plan.autumn_id === 'free') {
      router.push('/logs')
      return
    }

    setIsLoading(plan.autumn_id)

    try {
      const result = await attach({ 
        productId: plan.autumn_id,
        successUrl: `${window.location.origin}/logs?upgrade=true&product=${plan.autumn_id}`,
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
      toast.success(`Successfully upgraded to ${plan.name} plan!`)
      router.push('/logs')
    } catch (error) {
      console.error('Plan selection error:', error)
      toast.error('Failed to process plan change. Please try again.')
      setIsLoading(null)
    }
    // Note: Don't reset isLoading if redirect is happening - keeps button in loading state
  }

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!session?.user) {
        setCurrentPlan(null)
        return
      }
      
      try {
        const response = await getAutumnCustomer()
        if (response.customer) {
          const mainProduct = response.customer.products?.find(
            (product: any) => product.status === "active" && !product.is_add_on
          )
          setCurrentPlan(mainProduct ? mainProduct.id : 'free')
        } else {
          setCurrentPlan('free')
        }
      } catch (error) {
        console.error('Error fetching customer data:', error)
        setCurrentPlan('free')
      }
    }
    
    fetchCustomer()
  }, [session?.user])

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#1c1917] selection:bg-[#8161FF]/20">
      <div className="max-w-2xl mx-auto px-6">
        <MarketingNav />

        {/* Hero */}
        <section className="pt-20 pb-12">
          <h1 className="font-heading text-[32px] leading-[1.2] tracking-tight mb-2">Pricing</h1>
          <p className="text-[#52525b] leading-relaxed">
            Simple, predictable pricing that scales with you.
          </p>
        </section>

        {/* Pricing Table */}
        <PricingTable 
          showHeader={false}
          onPlanSelect={handlePlanSelection}
          isLoading={isLoading}
          currentPlan={currentPlan}
        />

        {/* FAQ */}
        <section className="py-12 border-t border-[#e7e5e4]">
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-6">FAQ</h2>
          <div className="space-y-6">
            <div>
              <p className="text-[#1c1917]">Can I use my own domain?</p>
              <p className="text-sm text-[#52525b] mt-1">
                Yes. Configure your MX records to point to our servers and you can receive email at any address on your domain.
              </p>
            </div>
            <div>
              <p className="text-[#1c1917]">How fast are webhooks delivered?</p>
              <p className="text-sm text-[#52525b] mt-1">
                Typically under 100ms from when we receive the email. We retry failed webhooks with exponential backoff.
              </p>
            </div>
            <div>
              <p className="text-[#1c1917]">What about spam filtering?</p>
              <p className="text-sm text-[#52525b] mt-1">
                We run incoming email through spam detection. You can choose to reject, flag, or accept spam in your mailbox settings.
              </p>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </div>
  )
}

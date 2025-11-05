"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import CircleCheck from '@/components/icons/circle-check'
import Loader from "@/components/icons/loader"
import { useAutumn } from "autumn-js/react"
import { getAutumnCustomer } from '@/app/actions/primary'

export const PricingTable = () => {
  const { attach } = useAutumn()
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)

  const plans = [
    {
      name: 'Free',
      price: 0,
      description: 'Perfect for getting started',
      emails: '5,000',
      domains: '2',
      aliases: 'Unlimited',
      retention: '7 days',
      features: ['5,000 emails/month', '2 domains', 'Unlimited aliases', 'TypeScript SDK', 'REST API access', 'Basic webhooks'],
      autumn_id: 'free_tier'
    },
    {
      name: 'Pro',
      price: 15,
      description: 'For growing applications',
      emails: '50,000',
      domains: '50',
      aliases: 'Unlimited',
      retention: '30 days',
      features: ['50,000 emails/month', '50 domains', 'Unlimited aliases', 'TypeScript SDK', 'REST API access', 'Advanced webhooks'],
      autumn_id: 'pro'
    },
    {
      name: 'Growth',
      price: 39,
      description: 'For scaling businesses',
      emails: '100,000',
      domains: '200',
      aliases: 'Unlimited',
      retention: '45 days',
      features: ['100,000 emails/month', '200 domains', 'Unlimited aliases', 'TypeScript SDK', 'REST API access', 'Advanced webhooks'],
      autumn_id: 'growth'
    },
    {
      name: 'Scale',
      price: 79,
      description: 'For enterprise applications',
      emails: '200,000',
      domains: '500',
      aliases: 'Unlimited',
      retention: '60 days',
      features: ['200,000 emails/month', '500 domains', 'Unlimited aliases', 'TypeScript SDK', 'REST API access', 'Advanced webhooks'],
      autumn_id: 'scale'
    }
  ]

  const handlePlanSelection = async (plan: typeof plans[0]) => {
    if (plan.autumn_id === 'free_tier') {
      return
    }

    setIsLoading(plan.autumn_id)

    try {
      await attach({ 
        productId: plan.autumn_id,
        successUrl: `${window.location.origin}/settings?upgrade=true&product=${plan.autumn_id}`,
      })
    } catch (error) {
      console.error('Plan selection error:', error)
    } finally {
      setIsLoading(null)
    }
  }

  const getButtonText = (plan: typeof plans[0]) => {
    if (currentPlan === null) {
      return `Select ${plan.name}`
    }
    
    if (currentPlan === plan.autumn_id) {
      return 'Current Plan'
    }
    
    const planHierarchy = {
      'free_tier': 0,
      'pro': 1, 
      'growth': 2,
      'scale': 3
    }
    
    const currentLevel = planHierarchy[currentPlan as keyof typeof planHierarchy] ?? 0
    const targetLevel = planHierarchy[plan.autumn_id as keyof typeof planHierarchy] ?? 0
    
    if (targetLevel > currentLevel) {
      return `Upgrade to ${plan.name}`
    } else if (targetLevel < currentLevel) {
      return `Downgrade to ${plan.name}`
    } else {
      return `Change to ${plan.name}`
    }
  }
  
  const isCurrentPlan = (plan: typeof plans[0]) => {
    return currentPlan === plan.autumn_id
  }

  // Fetch customer subscription data to detect current plan
  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const response = await getAutumnCustomer()
        if (response.customer) {
          const mainProduct = response.customer.products?.find(
            (product: any) => product.status === "active" && !product.is_add_on
          )
          
          if (mainProduct) {
            setCurrentPlan(mainProduct.id)
          } else {
            setCurrentPlan('free_tier')
          }
        } else {
          setCurrentPlan('free_tier')
        }
      } catch (error) {
        console.error('Error fetching customer data:', error)
        setCurrentPlan('free_tier')
      }
    }
    
    fetchCustomer()
  }, [])

  if (currentPlan === null) {
    return (
      <div className="w-full h-full flex justify-center items-center min-h-[300px]">
        <Loader className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      {plans.map((plan) => (
        <div
          key={plan.name}
          className={`bg-card border border-dotted rounded-none p-8 relative ${
            isCurrentPlan(plan) 
              ? 'border-foreground' 
              : 'border-border'
          }`}
        >
          {isCurrentPlan(plan) && (
            <div className="absolute top-2 left-2 text-xs text-muted-foreground border border-dotted rounded-none px-2 py-0.5">
              Current plan
            </div>
          )}
          
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
            
            <div className="mb-4">
              <span className="text-4xl font-bold">
                ${plan.price}
              </span>
              <span className="text-muted-foreground">/month</span>
            </div>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>{plan.emails} emails/month</div>
              <div>{plan.domains} domains</div>
              <div>{plan.aliases} aliases</div>
              <div>{plan.retention} data retention</div>
            </div>
          </div>

          <Button
            className="w-full mb-6"
            variant={isCurrentPlan(plan) ? 'secondary' : 'outline'}
            onClick={() => handlePlanSelection(plan)}
            disabled={isLoading === plan.autumn_id || isCurrentPlan(plan)}
          >
            {isLoading === plan.autumn_id ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Processing...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {getButtonText(plan)}
                {isCurrentPlan(plan) && (
                  <CircleCheck width="16" height="16" className="text-foreground" fill="currentColor" secondaryfill="var(--muted-foreground)" />
                )}
              </div>
            )}
          </Button>

          <div className="space-y-3">
            {plan.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <CircleCheck width="16" height="16" className="text-foreground mt-0.5 flex-shrink-0" fill="currentColor" secondaryfill="var(--muted-foreground)" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

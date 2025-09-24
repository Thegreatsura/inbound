"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRetryDeliveryMutation } from '@/features/emails/hooks'
import Refresh2 from '@/components/icons/refresh-2'
import Loader from '@/components/icons/loader'
import { toast } from 'sonner'

interface RetryDeliveryButtonProps {
  emailId: string
  deliveryId: string
  status: string
  disabled?: boolean
}

export function RetryDeliveryButton({ 
  emailId, 
  deliveryId, 
  status, 
  disabled = false 
}: RetryDeliveryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const retryMutation = useRetryDeliveryMutation()

  const handleRetry = async () => {
    if (isRetrying || disabled) return

    setIsRetrying(true)
    
    try {
      const result = await retryMutation.mutateAsync({
        emailId,
        deliveryId
      })

      if (result.success) {
        toast.success('Email re-delivery initiated successfully')
        // Refresh the page to show updated delivery status
        setTimeout(() => {
          window.location.reload()
        }, 1000) // Brief delay to show the toast message
      } else {
        toast.error(result.error || 'Failed to retry delivery')
      }
    } catch (error) {
      console.error('Retry delivery error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to retry delivery')
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={isRetrying || disabled}
      className="h-8 px-3"
      title={isRetrying ? 'Re-delivering email...' : 'Re-deliver email to endpoint'}
    >
      {isRetrying ? (
        <Loader width="14" height="14" className="mr-1.5 animate-spin" />
      ) : (
        <Refresh2 width="14" height="14" className="mr-1.5" />
      )}
      {isRetrying ? 'Sending...' : 'Retry'}
    </Button>
  )
}

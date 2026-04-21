// Domains API service layer
import { getDomainStats } from '@/app/actions/primary'

export interface DomainStats {
  id: string
  domain: string
  status: string
  isVerified: boolean
  isCatchAllEnabled: boolean
  catchAllWebhookId: string | null
  catchAllEndpointId: string | null
  emailAddressCount: number
  emailsLast24h: number
  createdAt: string
  updatedAt: string
}

export interface DomainStatsResponse {
  domains: DomainStats[]
  totalDomains: number
  verifiedDomains: number
  totalEmailAddresses: number
  totalEmailsLast24h: number
  limits?: {
    allowed: boolean
    unlimited: boolean
    balance: number | null
    current: number
    remaining: number | null
  } | null
}

export const domainsApi = {
  getDomainStats: async (): Promise<DomainStatsResponse> => {
    const result = await getDomainStats()
    
    if ('error' in result) {
      throw new Error(result.error || 'Failed to fetch domain statistics')
    }
    
    return result
  },
} 
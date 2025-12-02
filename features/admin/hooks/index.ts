import { useQuery } from '@tanstack/react-query'
import { 
  getAdminTenantList, 
  getAdminSESAccountStats,
  TenantWithMetrics,
  AdminTenantListResult
} from '@/app/actions/admin-tenants'
import { 
  getUserAnalytics, 
  UserAnalyticsData 
} from '@/app/actions/user-analytics'

// Query keys for admin data
export const adminKeys = {
  all: ['admin'] as const,
  tenants: () => [...adminKeys.all, 'tenants'] as const,
  tenantsWithParams: (params?: AdminTenantsQueryParams) => [...adminKeys.tenants(), params] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  sesStats: () => [...adminKeys.all, 'ses-stats'] as const,
}

// Types
export interface AdminTenantsQueryParams {
  search?: string
  sortBy?: 'tenantName' | 'createdAt' | 'sends' | 'receives'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface AdminTenantsResult {
  tenants: TenantWithMetrics[]
  total: number
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }
}

/**
 * Hook to fetch admin tenant list with AWS metrics
 * Includes tenant info, domains, AWS status, and CloudWatch metrics
 * Now supports pagination for better performance
 */
export function useAdminTenantsQuery(params?: AdminTenantsQueryParams) {
  return useQuery<AdminTenantsResult | null>({
    queryKey: adminKeys.tenantsWithParams(params),
    queryFn: async () => {
      const result = await getAdminTenantList(params)
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch tenants')
      }
      return {
        tenants: result.tenants || [],
        total: result.total || 0,
        pagination: result.pagination || { limit: 50, offset: 0, hasMore: false },
      }
    },
    staleTime: 60 * 1000, // 1 minute - metrics update frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

/**
 * Hook to fetch user analytics data
 * Includes overview stats, top users with risk scores, suspicious activity, trends
 */
export function useAdminUsersQuery() {
  return useQuery<UserAnalyticsData | null>({
    queryKey: adminKeys.users(),
    queryFn: async () => {
      const result = await getUserAnalytics()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch user analytics')
      }
      return result.data || null
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

/**
 * Hook to fetch SES account-level statistics
 * Includes sending status, quotas, enforcement status
 */
export function useAdminSESAccountStatsQuery() {
  return useQuery({
    queryKey: adminKeys.sesStats(),
    queryFn: async () => {
      const result = await getAdminSESAccountStats()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch SES account stats')
      }
      return result.stats || null
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

// Re-export types for convenience
export type { TenantWithMetrics } from '@/app/actions/admin-tenants'
export type { 
  UserAnalyticsData, 
  TopUserActivity, 
  UserStatsOverview,
  SuspiciousActivity 
} from '@/app/actions/user-analytics'

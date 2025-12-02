import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { checkMigrationNeeded, migrateWebhooksToEndpoints } from '@/app/actions/endpoints'
import { client } from '@/lib/api/client'
import type { EndpointWithStats } from '../types'

export type EndpointsQueryParams = {
  sortBy?: 'newest' | 'oldest'
  type?: 'webhook' | 'email' | 'email_group'
  active?: boolean
  search?: string
  limit?: number
  offset?: number
}

async function fetchEndpoints(params?: EndpointsQueryParams): Promise<{ data: EndpointWithStats[], pagination: { total: number, hasMore: boolean, limit: number, offset: number } }> {
  const { data, error } = await client.api.e2.endpoints.get({
    query: {
      sortBy: params?.sortBy,
      type: params?.type,
      active: params?.active !== undefined ? (params.active ? 'true' : 'false') : undefined,
      search: params?.search,
      limit: params?.limit,
      offset: params?.offset,
    }
  })

  if (error) {
    throw new Error((error as any)?.error || 'Failed to fetch endpoints')
  }

  return {
    data: (data?.data || []) as unknown as EndpointWithStats[],
    pagination: data?.pagination || { total: 0, hasMore: false, limit: 50, offset: 0 }
  }
}

export const useEndpointsQuery = (sortByOrParams?: 'newest' | 'oldest' | EndpointsQueryParams) => {
  const queryClient = useQueryClient()
  const [migrationChecked, setMigrationChecked] = useState(false)
  const [migrationInProgress, setMigrationInProgress] = useState(false)

  // Normalize params - support both legacy sortBy string and new params object
  const params: EndpointsQueryParams = typeof sortByOrParams === 'string' 
    ? { sortBy: sortByOrParams }
    : sortByOrParams || {}

  const endpointsQuery = useQuery({
    queryKey: ['endpoints', params],
    queryFn: () => fetchEndpoints(params),
    staleTime: 30 * 1000, // 30 seconds (reduced from 5 minutes for better UX)
    refetchOnWindowFocus: true, // Refetch when user returns to tab/page
    select: (result) => result, // Keep full response with pagination
  })

  // Check for migration needs when the query succeeds and returns empty results
  useEffect(() => {
    const checkAndMigrate = async () => {
      // Only check migration if:
      // 1. Query has succeeded
      // 2. No endpoints found
      // 3. Migration hasn't been checked yet
      // 4. Migration is not already in progress
      if (
        endpointsQuery.isSuccess &&
        endpointsQuery.data?.data?.length === 0 &&
        !migrationChecked &&
        !migrationInProgress
      ) {
        try {
          console.log('🔍 Checking if webhook migration is needed...')
          
          const migrationCheck = await checkMigrationNeeded()
          
          if (migrationCheck.success && migrationCheck.migrationNeeded) {
            // Only set migration in progress if we actually need to migrate
            setMigrationInProgress(true)
            
            console.log('🚀 Starting automatic webhook migration...')
            
            const migrationResult = await migrateWebhooksToEndpoints()
            
            if (migrationResult.success) {
              console.log(`✅ Migration completed: ${migrationResult.migratedCount} webhooks migrated`)
              
              // Invalidate and refetch endpoints to show the migrated data
              queryClient.invalidateQueries({ queryKey: ['endpoints'] })
            } else {
              console.error('❌ Migration failed:', migrationResult.error)
            }
          } else {
            console.log('ℹ️ No migration needed')
          }
        } catch (error) {
          console.error('❌ Error during migration check/process:', error)
        } finally {
          setMigrationChecked(true)
          setMigrationInProgress(false)
        }
      }
    }

    checkAndMigrate()
  }, [endpointsQuery.isSuccess, endpointsQuery.data, migrationChecked, migrationInProgress, queryClient])

  // Return backward-compatible response with data array at top level + pagination
  return {
    ...endpointsQuery,
    // Backward compatibility: expose data array directly (like the old hook)
    data: endpointsQuery.data?.data || [],
    // New: expose pagination info
    pagination: endpointsQuery.data?.pagination,
    migrationInProgress,
    migrationChecked
  }
} 
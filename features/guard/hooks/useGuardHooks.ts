import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  GuardRule,
  CreateGuardRuleRequest,
  UpdateGuardRuleRequest,
  CheckRuleMatchRequest,
  CheckRuleMatchResponse,
  GenerateExplicitRulesResponse,
} from '../types';
import type {
  GetGuardRulesResponse,
} from '@/app/api/v2/guard/route';
import type {
  GetGuardRuleResponse,
  UpdateGuardRuleResponse,
  DeleteGuardRuleResponse,
} from '@/app/api/v2/guard/[id]/route';

// Query keys
export const guardKeys = {
  all: ['guard'] as const,
  lists: () => [...guardKeys.all, 'list'] as const,
  list: (filters?: Record<string, string>) => [...guardKeys.lists(), filters] as const,
  details: () => [...guardKeys.all, 'detail'] as const,
  detail: (id: string) => [...guardKeys.details(), id] as const,
};

// Query hook - List all guard rules
export function useGuardRulesQuery(params?: {
  search?: string;
  type?: 'explicit' | 'ai_prompt';
  isActive?: boolean;
  limit?: number;
  offset?: number;
}) {
  return useQuery<GetGuardRulesResponse>({
    queryKey: guardKeys.list(params ? Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ) : {}),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.type) searchParams.set('type', params.type);
      if (params?.isActive !== undefined) searchParams.set('isActive', params.isActive.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.offset) searchParams.set('offset', params.offset.toString());

      const response = await fetch(`/api/v2/guard?${searchParams.toString()}`);
      if (!response.ok) {
        let errorMessage = 'Failed to fetch guard rules';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }
      // Response already matches GetGuardRulesResponse with v2 envelope
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Query hook - Get single guard rule
export function useGuardRuleQuery(ruleId: string) {
  return useQuery<GetGuardRuleResponse>({
    queryKey: guardKeys.detail(ruleId),
    queryFn: async () => {
      const response = await fetch(`/api/v2/guard/${ruleId}`);
      if (!response.ok) {
        let errorMessage = 'Failed to fetch guard rule';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    enabled: !!ruleId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Mutation hook - Create guard rule
export function useCreateGuardRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation<GuardRule, Error, CreateGuardRuleRequest>({
    mutationFn: async (data) => {
      const response = await fetch('/api/v2/guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create guard rule';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      // Handle v2 API envelope format - extract data from envelope
      if (result.success && result.data) {
        return result.data;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guardKeys.lists() });
      toast.success('Guard rule created successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create guard rule');
    },
  });
}

// Mutation hook - Update guard rule
export function useUpdateGuardRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    UpdateGuardRuleResponse,
    Error,
    { ruleId: string; data: UpdateGuardRuleRequest }
  >({
    mutationFn: async ({ ruleId, data }) => {
      const response = await fetch(`/api/v2/guard/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update guard rule';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: guardKeys.lists() });
      queryClient.invalidateQueries({ queryKey: guardKeys.detail(variables.ruleId) });
      toast.success('Guard rule updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update guard rule');
    },
  });
}

// Mutation hook - Delete guard rule
export function useDeleteGuardRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation<DeleteGuardRuleResponse, Error, string>({
    mutationFn: async (ruleId) => {
      const response = await fetch(`/api/v2/guard/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let errorMessage = 'Failed to delete guard rule';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (_, ruleId) => {
      queryClient.invalidateQueries({ queryKey: guardKeys.lists() });
      queryClient.removeQueries({ queryKey: guardKeys.detail(ruleId) });
      toast.success('Guard rule deleted successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete guard rule');
    },
  });
}

// Mutation hook - Check if rule matches email
export function useGuardRuleCheckMutation() {
  return useMutation<
    CheckRuleMatchResponse,
    Error,
    { ruleId: string; data: CheckRuleMatchRequest }
  >({
    mutationFn: async ({ ruleId, data }) => {
      const response = await fetch(`/api/v2/guard/${ruleId}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to check rule match';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
  });
}

// Mutation hook - Toggle rule active status
export function useToggleGuardRuleActiveMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    UpdateGuardRuleResponse,
    Error,
    { ruleId: string; isActive: boolean }
  >({
    mutationFn: async ({ ruleId, isActive }) => {
      const response = await fetch(`/api/v2/guard/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to toggle guard rule';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: guardKeys.lists() });
      queryClient.invalidateQueries({ queryKey: guardKeys.detail(variables.ruleId) });
      toast.success(
        variables.isActive
          ? 'Guard rule activated'
          : 'Guard rule deactivated'
      );
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to toggle guard rule');
    },
  });
}

// Mutation hook - Generate explicit rules from natural language
export function useGenerateRulesMutation() {
  return useMutation<GenerateExplicitRulesResponse, Error, string>({
    mutationFn: async (prompt: string) => {
      const response = await fetch('/api/v2/guard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate rules';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate rules');
    },
  });
}


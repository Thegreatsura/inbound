import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client, getEdenErrorMessage } from "@/lib/api/client";
import type {
	GetEmailAddressesResponse,
	GetEmailAddressesRequest,
	PostEmailAddressesRequest,
	PostEmailAddressesResponse,
	GetEmailAddressByIdResponse,
	PutEmailAddressByIdRequest,
	PutEmailAddressByIdResponse,
	DeleteEmailAddressByIdResponse,
} from "@/lib/api-types";

// Query keys for v2 email addresses API
export const emailAddressesV2Keys = {
	all: ["v2", "email-addresses"] as const,
	lists: () => [...emailAddressesV2Keys.all, "list"] as const,
	list: (params?: GetEmailAddressesRequest) =>
		[...emailAddressesV2Keys.lists(), params] as const,
	details: () => [...emailAddressesV2Keys.all, "detail"] as const,
	detail: (emailAddressId: string) =>
		[...emailAddressesV2Keys.details(), emailAddressId] as const,
};

// Hook for listing email addresses - uses Elysia e2 API via Eden
export const useEmailAddressesV2Query = (params?: GetEmailAddressesRequest) => {
	return useQuery<GetEmailAddressesResponse>({
		queryKey: emailAddressesV2Keys.list(params),
		queryFn: async () => {
			const { data, error } = await client.api.e2["email-addresses"].get({
				query: {
					limit: params?.limit,
					offset: params?.offset,
					domainId: params?.domainId,
					isActive: params?.isActive,
					isReceiptRuleConfigured: params?.isReceiptRuleConfigured,
				},
			});

			if (error) {
				throw new Error(
					getEdenErrorMessage(error, "Failed to fetch email addresses"),
				);
			}

			return data as unknown as GetEmailAddressesResponse;
		},
		staleTime: 2 * 60 * 1000, // 2 minutes
		gcTime: 5 * 60 * 1000, // 5 minutes
	});
};

// Hook for getting email address details - uses Elysia e2 API via Eden
export const useEmailAddressV2Query = (emailAddressId: string) => {
	return useQuery<GetEmailAddressByIdResponse>({
		queryKey: emailAddressesV2Keys.detail(emailAddressId),
		queryFn: async () => {
			const { data, error } = await client.api.e2["email-addresses"]({
				id: emailAddressId,
			}).get();

			if (error) {
				throw new Error(
					getEdenErrorMessage(error, "Failed to fetch email address"),
				);
			}

			return data as unknown as GetEmailAddressByIdResponse;
		},
		enabled: !!emailAddressId,
		staleTime: 2 * 60 * 1000, // 2 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
	});
};

// Hook for creating email address - uses Elysia e2 API via Eden
export const useCreateEmailAddressV2Mutation = () => {
	const queryClient = useQueryClient();

	return useMutation<
		PostEmailAddressesResponse,
		Error,
		PostEmailAddressesRequest
	>({
		mutationFn: async (data) => {
			const { data: responseData, error } =
				await client.api.e2["email-addresses"].post({
					address: data.address,
					domainId: data.domainId,
					endpointId: data.endpointId,
					webhookId: data.webhookId,
					isActive: data.isActive,
				});

			if (error) {
				throw new Error(
					getEdenErrorMessage(error, "Failed to create email address"),
				);
			}

			return responseData as unknown as PostEmailAddressesResponse;
		},
		onSuccess: () => {
			// Invalidate email addresses lists
			queryClient.invalidateQueries({ queryKey: emailAddressesV2Keys.lists() });
			// Also invalidate domains queries since this affects domain stats
			queryClient.invalidateQueries({ queryKey: ["v2", "domains"] });
		},
	});
};

// Hook for updating email address - uses Elysia e2 API via Eden
export const useUpdateEmailAddressV2Mutation = () => {
	const queryClient = useQueryClient();

	return useMutation<
		PutEmailAddressByIdResponse,
		Error,
		PutEmailAddressByIdRequest & { emailAddressId: string }
	>({
		mutationFn: async ({ emailAddressId, ...data }) => {
			const { data: responseData, error } = await client.api.e2[
				"email-addresses"
			]({ id: emailAddressId }).put({
				endpointId: data.endpointId,
				webhookId: data.webhookId,
				isActive: data.isActive,
			});

			if (error) {
				throw new Error(
					getEdenErrorMessage(error, "Failed to update email address"),
				);
			}

			return responseData as unknown as PutEmailAddressByIdResponse;
		},
		onSuccess: (_, { emailAddressId }) => {
			// Invalidate specific email address and lists
			queryClient.invalidateQueries({
				queryKey: emailAddressesV2Keys.detail(emailAddressId),
			});
			queryClient.invalidateQueries({ queryKey: emailAddressesV2Keys.lists() });
			// Also invalidate domains queries since this affects domain stats
			queryClient.invalidateQueries({ queryKey: ["v2", "domains"] });
		},
	});
};

// Hook for deleting email address - uses Elysia e2 API via Eden
export const useDeleteEmailAddressV2Mutation = () => {
	const queryClient = useQueryClient();

	return useMutation<DeleteEmailAddressByIdResponse, Error, string>({
		mutationFn: async (emailAddressId) => {
			const { data, error } = await client.api.e2["email-addresses"]({
				id: emailAddressId,
			}).delete();

			if (error) {
				throw new Error(
					getEdenErrorMessage(error, "Failed to delete email address"),
				);
			}

			return data as DeleteEmailAddressByIdResponse;
		},
		onSuccess: (_, emailAddressId) => {
			// Remove from cache and invalidate lists
			queryClient.removeQueries({
				queryKey: emailAddressesV2Keys.detail(emailAddressId),
			});
			queryClient.invalidateQueries({ queryKey: emailAddressesV2Keys.lists() });
			// Also invalidate domains queries since this affects domain stats
			queryClient.invalidateQueries({ queryKey: ["v2", "domains"] });
		},
	});
};

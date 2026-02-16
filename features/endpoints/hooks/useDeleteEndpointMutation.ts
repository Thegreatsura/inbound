import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import { trackEvent } from "@/lib/utils/visitors";

type DeleteEndpointResponse = {
	message?: string;
	cleanup?: {
		emailAddressesUpdated: number;
		emailAddresses: string[];
		domainsUpdated: number;
		domains: string[];
		groupEmailsDeleted: number;
		deliveriesDeleted: number;
	};
};

async function deleteEndpoint(id: string): Promise<DeleteEndpointResponse> {
	const { data, error } = await client.api.e2.endpoints({ id }).delete();

	if (error) {
		throw new Error((error as any)?.error || "Failed to delete endpoint");
	}

	return data as DeleteEndpointResponse;
}

export const useDeleteEndpointMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteEndpoint,
		onSuccess: (result, endpointId) => {
			// Track endpoint deletion
			trackEvent("Endpoint Deleted", {
				endpointId: endpointId,
			});

			// Invalidate and refetch endpoints list
			queryClient.invalidateQueries({ queryKey: ["endpoints"] });
			// Also invalidate the specific endpoint query
			queryClient.removeQueries({ queryKey: ["endpoint", endpointId] });
		},
	});
};

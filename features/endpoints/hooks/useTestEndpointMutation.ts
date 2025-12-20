import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/api/client";
import type { WebhookFormat } from "@/lib/db/schema";

export type TestEndpointRequest = {
	id: string;
	webhookFormat?: WebhookFormat;
	overrideUrl?: string;
};

export type TestEndpointResponse = {
	success: boolean;
	message: string;
	responseTime: number;
	statusCode?: number;
	responseBody?: string;
	error?: string;
	testPayload?: Record<string, unknown>;
	webhookFormat?: WebhookFormat;
	urlTested?: string;
};

function extractErrorMessage(error: unknown): string {
	if (!error) return "Unknown error";
	if (typeof error === "string") return error;
	if (error instanceof Error) return error.message;

	const errorObj = error as Record<string, unknown>;

	// Check for common error message properties
	if (typeof errorObj.error === "string") return errorObj.error;
	if (typeof errorObj.message === "string") return errorObj.message;

	// Handle nested value property (common in Eden responses)
	if (errorObj.value && typeof errorObj.value === "object") {
		const value = errorObj.value as Record<string, unknown>;
		if (typeof value.error === "string") return value.error;
		if (typeof value.message === "string") return value.message;
	}

	// Try to get a useful string representation
	try {
		const str = JSON.stringify(error);
		// Avoid returning massive objects
		if (str.length < 500) return str;
	} catch {
		// JSON.stringify failed
	}

	return "Request failed - check network connectivity";
}

async function testEndpoint(
	params: TestEndpointRequest,
): Promise<TestEndpointResponse> {
	const { id, webhookFormat, overrideUrl } = params;

	const { data, error } = await client.api.e2.endpoints({ id }).test.post({
		webhookFormat,
		overrideUrl,
	});

	if (error) {
		// Handle error responses - they might have success: false
		const errorData = error as Record<string, unknown>;
		if (errorData?.success === false) {
			return errorData as unknown as TestEndpointResponse;
		}
		throw new Error(extractErrorMessage(error));
	}

	return data as TestEndpointResponse;
}

export const useTestEndpointMutation = () => {
	return useMutation({
		mutationFn: testEndpoint,
	});
};

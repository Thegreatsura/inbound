import { treaty } from "@elysiajs/eden";
import type { App } from "@/app/api/e2/[[...slugs]]/route";

/**
 * Get the base URL for API requests.
 * - Server-side: Uses BETTER_AUTH_URL or defaults to localhost
 * - Client-side: Uses current window origin
 */
const getBaseUrl = () => {
	if (typeof window === "undefined") {
		// Server-side
		return process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000";
	}
	// Client-side - use current origin
	return process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000";
};

/**
 * Eden treaty client for type-safe API calls to the Elysia e2 API.
 *
 * Usage:
 * ```typescript
 * import { client } from "@/lib/api/client"
 *
 * // Type-safe domain creation
 * const { data, error } = await client.api.e2.domains.post({ domain: "example.com" })
 * ```
 */
export const client = treaty<App>(getBaseUrl(), {
	fetch: {
		credentials: "include",
	},
});

/**
 * Extract error message from Eden treaty error response.
 * Handles both string errors (e.g., "NOT_FOUND") and object errors.
 *
 * @param error - The error from Eden treaty response
 * @param fallbackMessage - Default message if error cannot be parsed
 * @returns Human-readable error message
 */
export function getEdenErrorMessage(
	error: unknown,
	fallbackMessage = "An error occurred",
): string {
	if (!error) return fallbackMessage;

	// Handle plain string errors (e.g., "NOT_FOUND" from Elysia)
	if (typeof error === "string") {
		// Convert error codes to readable messages
		if (error === "NOT_FOUND") return "Resource not found";
		if (error === "VALIDATION") return "Validation failed";
		if (error === "UNAUTHORIZED") return "Unauthorized";
		return error;
	}

	// Handle object errors with various structures
	if (typeof error === "object") {
		const err = error as Record<string, unknown>;
		// Try common error message fields
		if (typeof err.error === "string") return err.error;
		if (typeof err.message === "string") return err.message;
		// Handle nested value property (Eden sometimes wraps errors)
		if (err.value && typeof err.value === "object") {
			const value = err.value as Record<string, unknown>;
			if (typeof value.error === "string") return value.error;
			if (typeof value.message === "string") return value.message;
		}
	}

	return fallbackMessage;
}

/**
 * Safely parse a fetch Response as JSON, handling non-JSON responses gracefully.
 * Returns the parsed JSON or an object with the text content as an error.
 *
 * @param response - The fetch Response object
 * @returns Parsed JSON object or { error: string } for non-JSON responses
 */
export async function safeResponseJson(
	response: Response,
): Promise<{ error?: string; [key: string]: unknown }> {
	const text = await response.text();
	if (!text) {
		return { error: `HTTP error ${response.status}` };
	}
	try {
		return JSON.parse(text);
	} catch {
		// Response wasn't JSON - convert known error codes to messages
		if (text === "NOT_FOUND") return { error: "Resource not found" };
		if (text === "VALIDATION") return { error: "Validation failed" };
		if (text === "UNAUTHORIZED") return { error: "Unauthorized" };
		return { error: text };
	}
}

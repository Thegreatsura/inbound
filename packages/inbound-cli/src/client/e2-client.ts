import { Inbound } from "inboundemail";

export type ClientOptions = {
	apiKey: string;
	baseUrl: string;
};

export function createSdkClient(options: ClientOptions): Inbound {
	return new Inbound({
		apiKey: options.apiKey,
		baseURL: options.baseUrl,
	});
}

function withQuery(path: string, query?: Record<string, unknown>): string {
	if (!query || Object.keys(query).length === 0) {
		return path;
	}

	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null) continue;
		params.append(key, String(value));
	}

	const encoded = params.toString();
	if (!encoded) {
		return path;
	}

	return `${path}?${encoded}`;
}

export async function rawE2Request<T>(input: {
	apiKey: string;
	baseUrl: string;
	path: string;
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	query?: Record<string, unknown>;
	body?: unknown;
	accept?: string;
}): Promise<T> {
	const method = input.method || "GET";
	const url = `${input.baseUrl}${withQuery(input.path, input.query)}`;
	const response = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${input.apiKey}`,
			"Content-Type": "application/json",
			Accept: input.accept || "application/json",
		},
		body: input.body === undefined ? undefined : JSON.stringify(input.body),
	});

	const text = await response.text();
	const payload = text ? safeParseJson(text) : null;

	if (!response.ok) {
		const message =
			(payload && typeof payload === "object" && "error" in payload
				? String((payload as { error: string }).error)
				: text) ||
			`${method} ${input.path} failed with status ${response.status}`;
		throw new Error(message);
	}

	return payload as T;
}

export async function rawE2BinaryRequest(input: {
	apiKey: string;
	baseUrl: string;
	path: string;
}): Promise<{ bytes: Uint8Array; contentType: string | null }> {
	const url = `${input.baseUrl}${input.path}`;
	const response = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${input.apiKey}`,
			Accept: "*/*",
		},
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			text || `GET ${input.path} failed with status ${response.status}`,
		);
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	return {
		bytes,
		contentType: response.headers.get("content-type"),
	};
}

function safeParseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

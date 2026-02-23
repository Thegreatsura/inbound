import { type NextRequest, NextResponse } from "next/server";

const DEFAULT_BASE_URL = "https://inbound.new/api/e2";

function normalizeBaseUrl(rawBaseUrl: string | null): string {
	const candidate = (rawBaseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");

	if (!candidate) {
		throw new Error("Missing base URL");
	}

	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		throw new Error("Invalid base URL");
	}

	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		throw new Error("Base URL must use http or https");
	}

	const normalizedPath = parsed.pathname.replace(/\/+$/, "");
	if (!normalizedPath.endsWith("/api/e2")) {
		throw new Error("Base URL must end with /api/e2");
	}

	return `${parsed.origin}${normalizedPath}`;
}

async function proxyRequest(
	request: NextRequest,
	context: { params: Promise<{ slug: string[] }> },
) {
	const { slug } = await context.params;

	if (!Array.isArray(slug) || slug.length === 0) {
		return NextResponse.json({ error: "Missing API path" }, { status: 400 });
	}

	const inboundApiKey = request.headers.get("x-inbound-api-key")?.trim();
	if (!inboundApiKey) {
		return NextResponse.json(
			{ error: "Missing x-inbound-api-key header" },
			{ status: 400 },
		);
	}

	let normalizedBaseUrl: string;
	try {
		normalizedBaseUrl = normalizeBaseUrl(
			request.headers.get("x-inbound-base-url"),
		);
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Invalid base URL" },
			{ status: 400 },
		);
	}

	const targetUrl = new URL(`${normalizedBaseUrl}/${slug.join("/")}`);
	targetUrl.search = request.nextUrl.search;

	const headers = new Headers();
	headers.set("Authorization", `Bearer ${inboundApiKey}`);

	const contentType = request.headers.get("content-type");
	if (contentType) {
		headers.set("content-type", contentType);
	}

	const body =
		request.method === "GET" || request.method === "HEAD"
			? undefined
			: await request.text();

	let upstreamResponse: Response;
	try {
		upstreamResponse = await fetch(targetUrl.toString(), {
			method: request.method,
			headers,
			body,
			cache: "no-store",
		});
	} catch {
		return NextResponse.json(
			{ error: "Failed to reach Inbound API" },
			{ status: 502 },
		);
	}

	const responseBody = await upstreamResponse.text();
	const responseHeaders = new Headers();
	const responseContentType = upstreamResponse.headers.get("content-type");

	if (responseContentType) {
		responseHeaders.set("content-type", responseContentType);
	}

	return new NextResponse(responseBody, {
		status: upstreamResponse.status,
		headers: responseHeaders,
	});
}

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ slug: string[] }> },
) {
	return proxyRequest(request, context);
}

export async function POST(
	request: NextRequest,
	context: { params: Promise<{ slug: string[] }> },
) {
	return proxyRequest(request, context);
}

export async function PATCH(
	request: NextRequest,
	context: { params: Promise<{ slug: string[] }> },
) {
	return proxyRequest(request, context);
}

export async function DELETE(
	request: NextRequest,
	context: { params: Promise<{ slug: string[] }> },
) {
	return proxyRequest(request, context);
}

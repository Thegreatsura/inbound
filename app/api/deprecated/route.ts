import { NextResponse } from "next/server";

const deprecatedResponse = () =>
	NextResponse.json(
		{
			error: "Gone",
			message:
				"This API version has been deprecated and is no longer available. Please migrate to /api/e2/",
			statusCode: 410,
			documentation: "https://inbound.new/docs",
		},
		{ status: 410 },
	);

export async function GET() {
	return deprecatedResponse();
}

export async function POST() {
	return deprecatedResponse();
}

export async function PUT() {
	return deprecatedResponse();
}

export async function PATCH() {
	return deprecatedResponse();
}

export async function DELETE() {
	return deprecatedResponse();
}

export async function OPTIONS() {
	return deprecatedResponse();
}

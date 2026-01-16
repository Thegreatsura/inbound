import { NextResponse } from "next/server";

const deprecatedResponse = () =>
	NextResponse.json(
		{
			error: "Gone",
			message:
				"This API version and the @inboundemail/sdk package are deprecated due to security concerns. Please migrate to the official 'inboundemail' package (npm install inboundemail) and use the /api/e2 routes.",
			statusCode: 410,
			documentation: "https://inbound.new/docs",
			migration_guide: {
				old_sdk: "@inboundemail/sdk (deprecated)",
				new_sdk: "inboundemail",
				old_api: "/api/v1, /api/v1.1",
				new_api: "/api/e2",
				install: "npm install inboundemail",
			},
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

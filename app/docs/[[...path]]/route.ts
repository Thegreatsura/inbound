import { NextRequest, NextResponse } from "next/server";

/**
 * This route handler serves the API documentation at /docs
 * It renders a Scalar UI page that fetches the OpenAPI spec from /api/e2/openapi.json
 */
export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	const path = url.pathname;

	// If requesting the spec, proxy to the actual spec endpoint
	if (path === "/docs/openapi.json") {
		const specUrl = new URL("/api/e2/openapi.json", url.origin);
		const specResponse = await fetch(specUrl.toString());
		const spec = await specResponse.json();
		return NextResponse.json(spec);
	}

	// Serve the Scalar UI HTML page
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inbound API Documentation</title>
  <meta name="description" content="API documentation for Inbound email management">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-url="/openapi.json"
    data-configuration='{
      "theme": "purple",
      "layout": "modern",
      "darkMode": true,
      "hiddenClients": [],
      "authentication": {
        "preferredSecurityScheme": "bearerAuth"
      },
      "defaultOpenAllTags": true
    }'
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

	return new NextResponse(html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
		},
	});
}

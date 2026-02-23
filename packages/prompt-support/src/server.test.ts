import { describe, expect, it } from "bun:test";

import app from "./server";

describe("prompt support server", () => {
	it("serves /api/inbound", async () => {
		const response = await app.fetch(
			new Request("http://localhost/api/inbound"),
		);
		const body = (await response.json()) as {
			ok: boolean;
			endpoint: string;
			message: string;
		};

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.endpoint).toBe("/api/inbound");
	});

	it("returns 404 for unknown routes", async () => {
		const response = await app.fetch(new Request("http://localhost/not-found"));

		expect(response.status).toBe(404);
	});

	it("returns 405 for unsupported methods", async () => {
		const response = await app.fetch(
			new Request("http://localhost/api/inbound", { method: "PATCH" }),
		);

		expect(response.status).toBe(405);
	});
});

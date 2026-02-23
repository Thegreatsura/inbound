import { describe, expect, it } from "bun:test";
import {
	checkRateThresholds,
	RATE_THRESHOLDS,
	type TenantRates,
} from "@/lib/ses-monitoring/rate-tracker";

function buildRates(overrides: Partial<TenantRates>): TenantRates {
	const now = new Date();
	return {
		tenantId: "tenant_test",
		configurationSetName: "cfg-test",
		bounceRate: 0,
		complaintRate: 0,
		totalSends: 0,
		totalBounces: 0,
		totalComplaints: 0,
		windowStart: new Date(now.getTime() - 60_000),
		windowEnd: now,
		...overrides,
	};
}

describe("checkRateThresholds", () => {
	it("emits critical bounce alert at or above 2.5% with enough volume", () => {
		const rates = buildRates({
			totalSends: 200,
			totalBounces: 5,
			bounceRate: RATE_THRESHOLDS.bounce.critical,
		});

		const alerts = checkRateThresholds(rates);
		expect(alerts).toEqual([
			{
				alertType: "bounce",
				severity: "critical",
				currentRate: RATE_THRESHOLDS.bounce.critical,
				threshold: RATE_THRESHOLDS.bounce.critical,
				configurationSetName: "cfg-test",
				tenantId: "tenant_test",
			},
		]);
	});

	it("does not emit critical complaint alert without enough send volume", () => {
		const rates = buildRates({
			totalSends: 250,
			totalComplaints: 1,
			complaintRate: 1 / 250,
		});

		const alerts = checkRateThresholds(rates);
		expect(
			alerts.some(
				(alert) =>
					alert.alertType === "complaint" && alert.severity === "critical",
			),
		).toBe(false);
	});

	it("emits critical complaint alert at or above 0.1% with enough volume", () => {
		const rates = buildRates({
			totalSends: 1000,
			totalComplaints: 1,
			complaintRate: RATE_THRESHOLDS.complaint.critical,
		});

		const alerts = checkRateThresholds(rates);
		expect(alerts).toEqual([
			{
				alertType: "complaint",
				severity: "critical",
				currentRate: RATE_THRESHOLDS.complaint.critical,
				threshold: RATE_THRESHOLDS.complaint.critical,
				configurationSetName: "cfg-test",
				tenantId: "tenant_test",
			},
		]);
	});
});

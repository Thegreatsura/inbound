import {
	getAwsSesStats,
	max,
	renderAsciiChart,
	toTimePoints,
} from "@/lib/aws-ses/aws-stats-core";

const args = process.argv.slice(2);

function hasFlag(flag: string): boolean {
	return args.includes(flag);
}

function getOptionValue(flag: string): string | undefined {
	const inline = args.find((arg) => arg.startsWith(`${flag}=`));
	if (inline) {
		return inline.slice(flag.length + 1);
	}

	const index = args.indexOf(flag);
	if (index === -1 || index === args.length - 1) {
		return undefined;
	}

	return args[index + 1];
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
	if (!value) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return parsed;
}

function usage(): void {
	console.log(`AWS SES Stats

Usage:
  bun run scripts/aws-stats.ts [options]

Options:
  --days <n>              Lookback window in days (default: 7)
  --period-seconds <n>    Metric period in seconds (default: 3600)
  --chart-width <n>       Terminal chart width (default: 72)
  --chart-height <n>      Terminal chart height (default: 10)
  --no-graph              Disable terminal charts
  --json                  Output raw JSON
  --help                  Show this help text

Examples:
  bun run scripts/aws-stats.ts
  bun run scripts/aws-stats.ts --days 14 --period-seconds 1800
  bun run scripts/aws-stats.ts --chart-width 96 --chart-height 12
  bun run scripts/aws-stats.ts --json
`);
}

function formatCount(value: number): string {
	return Math.round(value).toLocaleString();
}

function formatPercent(value: number, digits = 2): string {
	return `${value.toFixed(digits)}%`;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "object" && error !== null && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (typeof message === "string") {
			return message;
		}
	}
	return "Unknown error";
}

if (hasFlag("--help")) {
	usage();
	process.exit(0);
}

const awsRegion = process.env.AWS_REGION || "us-east-2";
const lookbackDays = parsePositiveInt(getOptionValue("--days"), 7);
const periodSeconds = parsePositiveInt(getOptionValue("--period-seconds"), 3600);
const chartWidth = parsePositiveInt(getOptionValue("--chart-width"), 72);
const chartHeight = parsePositiveInt(getOptionValue("--chart-height"), 10);
const showGraphs = !hasFlag("--no-graph");
const asJson = hasFlag("--json");

async function main(): Promise<void> {
	const { output, series, reputationBounceRatePoints, reputationComplaintRatePoints } =
		await getAwsSesStats({
			lookbackDays,
			periodSeconds,
			region: awsRegion,
		});

	if (asJson) {
		console.log(JSON.stringify(output, null, 2));
		return;
	}

	console.log(
		"═══════════════════════════════════════════════════════════════════",
	);
	console.log("  AWS SES Stats");
	console.log(
		"═══════════════════════════════════════════════════════════════════",
	);
	console.log(`Region: ${output.region}`);
	console.log(
		`Window: ${output.window.startTime} → ${output.window.endTime} (${output.window.lookbackDays} day(s))`,
	);

	console.log("\nDaily email usage");
	console.log(
		`  Emails sent (24h):     ${formatCount(output.dailyUsage.emailsSentLast24Hours)}`,
	);
	console.log(
		`  Remaining sends:       ${formatCount(output.dailyUsage.remainingSends)}`,
	);
	console.log(
		`  Sending quota used:    ${formatPercent(output.dailyUsage.sendingQuotaUsedPercent, 2)}`,
	);
	console.log(
		`  Max 24h quota:         ${formatCount(output.dailyUsage.max24HourSend)}`,
	);
	console.log(
		`  Max send rate (sec):   ${output.dailyUsage.maxSendRate.toFixed(2)}`,
	);

	console.log("\nCloudWatch delivery metrics");
	console.log(`  Sends:                 ${formatCount(output.metrics.sends)}`);
	console.log(`  Rejects:               ${formatCount(output.metrics.rejects)}`);
	console.log(`  Bounces:               ${formatCount(output.metrics.bounces)}`);
	console.log(`  Complaints:            ${formatCount(output.metrics.complaints)}`);
	console.log(
		`  Reject rate:           ${formatPercent(output.metrics.rejectRatePercent)}`,
	);
	console.log(
		`  Bounce rate (observed): ${formatPercent(output.metrics.observedBounceRatePercent)}`,
	);
	console.log(
		`  Complaint rate (obs):  ${formatPercent(output.metrics.observedComplaintRatePercent, 3)}`,
	);
	console.log(
		`  Reputation bounce:     ${formatPercent(output.metrics.historicBounceRatePercent)}`,
	);
	console.log(
		`  Reputation complaint:  ${formatPercent(output.metrics.historicComplaintRatePercent, 3)}`,
	);
	console.log(
		`  Peak sends/period:     ${formatCount(output.metrics.peakSendsInPeriod)} (period=${periodSeconds}s)`,
	);

	console.log("\nReputation status");
	console.log(
		`  Historic bounce rate:  ${formatPercent(output.metrics.historicBounceRatePercent)} (${output.metrics.bounceStatus})`,
	);
	console.log(`  Bounce source:         ${output.metrics.historicBounceSource}`);
	console.log(
		`  Historic complaint:    ${formatPercent(output.metrics.historicComplaintRatePercent, 3)} (${output.metrics.complaintStatus})`,
	);
	console.log(
		`  Complaint source:      ${output.metrics.historicComplaintSource}`,
	);
	console.log(
		`  Latest bounce rate:    ${formatPercent(output.metrics.latestBounceRatePercent)}`,
	);
	console.log(
		`  Latest complaint rate: ${formatPercent(output.metrics.latestComplaintRatePercent, 3)}`,
	);
	console.log(
		`  Latest reject rate:    ${formatPercent(output.metrics.latestRejectRatePercent)}`,
	);
	console.log(
		`  Thresholds: bounce warning ${output.metrics.thresholds.bounceWarningPercent}% / at-risk ${output.metrics.thresholds.bounceAtRiskPercent}%, complaint warning ${output.metrics.thresholds.complaintWarningPercent}% / at-risk ${output.metrics.thresholds.complaintAtRiskPercent}%`,
	);

	if (showGraphs) {
		const sendPoints = toTimePoints(series.get("send"));
		const rejectRatePoints = toTimePoints(series.get("rejectrate"));
		const usingReputationBounceSeries = reputationBounceRatePoints.length > 0;
		const usingReputationComplaintSeries =
			reputationComplaintRatePoints.length > 0;
		const bounceRatePoints = usingReputationBounceSeries
			? reputationBounceRatePoints
			: toTimePoints(series.get("bouncerate"));
		const complaintRatePoints = usingReputationComplaintSeries
			? reputationComplaintRatePoints
			: toTimePoints(series.get("complaintrate"));

		const sendMaxValue = Math.max(
			1,
			max(sendPoints.map((point) => point.value)) * 1.1,
		);
		const rejectMaxValue = Math.max(
			1,
			max(rejectRatePoints.map((point) => point.value)) * 1.2,
		);
		const bounceMaxValue = Math.max(
			1,
			max(bounceRatePoints.map((point) => point.value)) * 1.2,
			output.metrics.thresholds.bounceAtRiskPercent * 1.2,
		);
		const complaintMaxValue = Math.max(
			0.2,
			max(complaintRatePoints.map((point) => point.value)) * 1.2,
			output.metrics.thresholds.complaintAtRiskPercent * 1.2,
		);

		console.log("\nTerminal graphs");
		console.log(
			renderAsciiChart({
				title: "Sends (count)",
				points: sendPoints,
				width: chartWidth,
				height: chartHeight,
				decimals: 0,
				unit: "",
				minValue: 0,
				maxValue: sendMaxValue,
			}),
		);
		console.log();
		console.log(
			renderAsciiChart({
				title: "Reject rate (%)",
				points: rejectRatePoints,
				width: chartWidth,
				height: chartHeight,
				decimals: 2,
				unit: "%",
				minValue: 0,
				maxValue: rejectMaxValue,
			}),
		);
		console.log();
		console.log(
			renderAsciiChart({
				title: usingReputationBounceSeries
					? "Bounce rate (%) [Reputation.BounceRate]"
					: "Bounce rate (%) [derived]",
				points: bounceRatePoints,
				width: chartWidth,
				height: chartHeight,
				decimals: 2,
				unit: "%",
				minValue: 0,
				maxValue: bounceMaxValue,
				referenceLines: [
					{ value: output.metrics.thresholds.bounceWarningPercent, label: "warning" },
					{ value: output.metrics.thresholds.bounceAtRiskPercent, label: "at-risk" },
				],
			}),
		);
		console.log();
		console.log(
			renderAsciiChart({
				title: usingReputationComplaintSeries
					? "Complaint rate (%) [Reputation.ComplaintRate]"
					: "Complaint rate (%) [derived]",
				points: complaintRatePoints,
				width: chartWidth,
				height: chartHeight,
				decimals: 3,
				unit: "%",
				minValue: 0,
				maxValue: complaintMaxValue,
				referenceLines: [
					{
						value: output.metrics.thresholds.complaintWarningPercent,
						label: "warning",
					},
					{
						value: output.metrics.thresholds.complaintAtRiskPercent,
						label: "at-risk",
					},
				],
			}),
		);
	}
}

main().catch((error) => {
	console.error("❌ aws-stats failed:", getErrorMessage(error));
	process.exit(1);
});

import {
	CloudWatchClient,
	GetMetricDataCommand,
	type MetricDataQuery,
} from "@aws-sdk/client-cloudwatch";
import { GetAccountCommand, SESv2Client } from "@aws-sdk/client-sesv2";

export type MetricSeries = {
	id: string;
	values: number[];
	timestamps: Date[];
};

export type TimePoint = {
	timestamp: Date;
	value: number;
};

type ReputationStatus = "Healthy" | "Warning" | "Account at risk";

export type AwsStatsOutput = {
	generatedAt: string;
	region: string;
	window: {
		startTime: string;
		endTime: string;
		lookbackDays: number;
		periodSeconds: number;
	};
	dailyUsage: {
		emailsSentLast24Hours: number;
		remainingSends: number;
		sendingQuotaUsedPercent: number;
		max24HourSend: number;
		maxSendRate: number;
	};
	metrics: {
		sends: number;
		rejects: number;
		bounces: number;
		complaints: number;
		rejectRatePercent: number;
		observedBounceRatePercent: number;
		observedComplaintRatePercent: number;
		historicBounceRatePercent: number;
		historicComplaintRatePercent: number;
		historicBounceSource: "Reputation.BounceRate" | "derived";
		historicComplaintSource: "Reputation.ComplaintRate" | "derived";
		latestRejectRatePercent: number;
		latestBounceRatePercent: number;
		latestComplaintRatePercent: number;
		peakSendsInPeriod: number;
		bounceStatus: ReputationStatus;
		complaintStatus: ReputationStatus;
		thresholds: {
			bounceWarningPercent: number;
			bounceAtRiskPercent: number;
			complaintWarningPercent: number;
			complaintAtRiskPercent: number;
		};
	};
};

export type AwsStatsResult = {
	output: AwsStatsOutput;
	series: Map<string, MetricSeries>;
	reputationBounceRatePoints: TimePoint[];
	reputationComplaintRatePoints: TimePoint[];
};

export type ReferenceLine = {
	value: number;
	label: string;
};

function getErrorName(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("name" in error)) {
		return undefined;
	}
	const name = (error as { name?: unknown }).name;
	return typeof name === "string" ? name : undefined;
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

function isRateLimitError(error: unknown): boolean {
	const name = (getErrorName(error) || "").toLowerCase();
	if (
		name.includes("throttl") ||
		name.includes("toomanyrequests") ||
		name.includes("ratelimit") ||
		name.includes("requestlimitexceeded")
	) {
		return true;
	}
	const message = getErrorMessage(error).toLowerCase();
	return (
		message.includes("rate exceeded") ||
		message.includes("too many requests") ||
		message.includes("throttl")
	);
}

function getRetryAfterMs(error: unknown): number | null {
	if (typeof error !== "object" || error === null) {
		return null;
	}
	if ("$retryAfterSeconds" in error) {
		const value = (error as { $retryAfterSeconds?: unknown }).$retryAfterSeconds;
		if (typeof value === "number" && Number.isFinite(value) && value > 0) {
			return Math.floor(value * 1_000);
		}
	}
	if ("retryAfterSeconds" in error) {
		const value = (error as { retryAfterSeconds?: unknown }).retryAfterSeconds;
		if (typeof value === "number" && Number.isFinite(value) && value > 0) {
			return Math.floor(value * 1_000);
		}
	}
	return null;
}

function wait(delayMs: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getRetryDelayMs(attempt: number): number {
	const baseDelayMs = 400;
	const maxDelayMs = 10_000;
	const jitterMs = Math.floor(Math.random() * 300);
	return Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) + jitterMs;
}

async function withAwsRetry<T>(
	operation: string,
	task: () => Promise<T>,
): Promise<T> {
	const maxRateRetries = 6;
	for (let attempt = 0; attempt <= maxRateRetries; attempt++) {
		try {
			return await task();
		} catch (error) {
			if (!isRateLimitError(error) || attempt === maxRateRetries) {
				throw error;
			}
			const retryAfterMs = getRetryAfterMs(error) ?? 0;
			const delayMs = Math.max(retryAfterMs, getRetryDelayMs(attempt));
			console.warn(
				`⚠️ ${operation}: rate exceeded, retry ${attempt + 1}/${maxRateRetries} in ${delayMs}ms`,
			);
			await wait(delayMs);
		}
	}
	throw new Error(`${operation} failed after retry attempts`);
}

function sum(values: number[]): number {
	return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}
	return sum(values) / values.length;
}

export function max(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}
	return values.reduce((currentMax, value) =>
		value > currentMax ? value : currentMax,
	);
}

function getLatestValue(series: MetricSeries | undefined): number {
	if (!series || series.values.length === 0) {
		return 0;
	}
	if (series.timestamps.length !== series.values.length) {
		return series.values[series.values.length - 1] ?? 0;
	}
	let latestIndex = 0;
	for (let index = 1; index < series.timestamps.length; index++) {
		if (
			series.timestamps[index].getTime() >
			series.timestamps[latestIndex].getTime()
		) {
			latestIndex = index;
		}
	}
	return series.values[latestIndex] ?? 0;
}

function getReputationStatus(
	ratePercent: number,
	warningThresholdPercent: number,
	atRiskThresholdPercent: number,
): ReputationStatus {
	if (ratePercent >= atRiskThresholdPercent) {
		return "Account at risk";
	}
	if (ratePercent >= warningThresholdPercent) {
		return "Warning";
	}
	return "Healthy";
}

function formatUtcLabel(value: Date): string {
	const year = value.getUTCFullYear();
	const month = String(value.getUTCMonth() + 1).padStart(2, "0");
	const day = String(value.getUTCDate()).padStart(2, "0");
	const hour = String(value.getUTCHours()).padStart(2, "0");
	const minute = String(value.getUTCMinutes()).padStart(2, "0");
	return `${year}-${month}-${day} ${hour}:${minute}Z`;
}

export function toTimePoints(series: MetricSeries | undefined): TimePoint[] {
	if (!series || series.values.length === 0) {
		return [];
	}
	const points: TimePoint[] = [];
	for (let index = 0; index < series.values.length; index++) {
		const value = series.values[index];
		if (!Number.isFinite(value)) {
			continue;
		}
		const timestamp = series.timestamps[index];
		if (!(timestamp instanceof Date)) {
			continue;
		}
		points.push({ timestamp, value });
	}
	points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
	return points;
}

function resampleTimePoints(points: TimePoint[], width: number): TimePoint[] {
	if (points.length <= width) {
		return points;
	}
	const result: TimePoint[] = [];
	for (let bucket = 0; bucket < width; bucket++) {
		const start = Math.floor((bucket * points.length) / width);
		const end = Math.floor(((bucket + 1) * points.length) / width);
		const slice = points.slice(start, Math.max(start + 1, end));
		if (slice.length === 0) {
			continue;
		}
		const avgValue =
			slice.reduce((total, point) => total + point.value, 0) / slice.length;
		result.push({
			timestamp: slice[slice.length - 1].timestamp,
			value: avgValue,
		});
	}
	return result;
}

export function scaleTimePoints(points: TimePoint[], factor: number): TimePoint[] {
	return points.map((point) => ({
		timestamp: point.timestamp,
		value: point.value * factor,
	}));
}

function clamp(value: number, minValue: number, maxValue: number): number {
	return Math.min(maxValue, Math.max(minValue, value));
}

function axisValueToRow(
	value: number,
	minValue: number,
	maxValue: number,
	height: number,
): number {
	if (maxValue <= minValue) {
		return 0;
	}
	const normalized = (value - minValue) / (maxValue - minValue);
	return clamp(Math.round(normalized * (height - 1)), 0, height - 1);
}

function formatAxisValue(value: number, decimals: number): string {
	if (!Number.isFinite(value)) {
		return "0";
	}
	if (decimals === 0) {
		return Math.round(value).toLocaleString();
	}
	return value.toFixed(decimals);
}

export function renderAsciiChart(params: {
	title: string;
	points: TimePoint[];
	width: number;
	height: number;
	decimals: number;
	unit: string;
	minValue?: number;
	maxValue?: number;
	referenceLines?: ReferenceLine[];
}): string {
	if (params.points.length === 0) {
		return `${params.title}\n  (no datapoints in window)`;
	}
	const sampled = resampleTimePoints(params.points, params.width);
	if (sampled.length === 0) {
		return `${params.title}\n  (no datapoints in window)`;
	}
	const values = sampled.map((point) => point.value);
	const referenceValues = (params.referenceLines ?? []).map((line) => line.value);
	const minFromData = Math.min(...values, ...referenceValues);
	const maxFromData = Math.max(...values, ...referenceValues);
	const minValue = params.minValue ?? minFromData;
	const maxValueRaw = params.maxValue ?? maxFromData;
	const maxValue = maxValueRaw > minValue ? maxValueRaw : minValue + 1;
	const width = sampled.length;
	const grid = Array.from({ length: params.height }, () =>
		Array.from({ length: width }, () => " "),
	);

	for (const line of params.referenceLines ?? []) {
		if (line.value < minValue || line.value > maxValue) {
			continue;
		}
		const row = axisValueToRow(line.value, minValue, maxValue, params.height);
		for (let x = 0; x < width; x++) {
			if (grid[row][x] === " ") {
				grid[row][x] = ".";
			}
		}
	}

	let previousX: number | null = null;
	let previousRow: number | null = null;
	for (let x = 0; x < sampled.length; x++) {
		const row = axisValueToRow(
			sampled[x].value,
			minValue,
			maxValue,
			params.height,
		);
		grid[row][x] = "*";
		if (previousX !== null && previousRow !== null && x > previousX + 1) {
			const span = x - previousX;
			for (let step = 1; step < span; step++) {
				const t = step / span;
				const interpolatedRow = Math.round(previousRow + (row - previousRow) * t);
				if (grid[interpolatedRow][previousX + step] === " ") {
					grid[interpolatedRow][previousX + step] = "*";
				}
			}
		}
		previousX = x;
		previousRow = row;
	}

	const latestValue = sampled[sampled.length - 1].value;
	const lines: string[] = [];
	lines.push(params.title);
	lines.push(
		`  latest=${formatAxisValue(latestValue, params.decimals)}${params.unit} min=${formatAxisValue(Math.min(...values), params.decimals)}${params.unit} max=${formatAxisValue(Math.max(...values), params.decimals)}${params.unit}`,
	);

	for (let row = params.height - 1; row >= 0; row--) {
		const yValue = minValue + ((maxValue - minValue) * row) / (params.height - 1);
		const yLabel = `${formatAxisValue(yValue, params.decimals)}${params.unit}`.padStart(10);
		lines.push(`${yLabel} |${grid[row].join("")}|`);
	}

	lines.push(`${" ".repeat(11)}+${"-".repeat(width)}+`);
	lines.push(
		`  time: ${formatUtcLabel(sampled[0].timestamp)} -> ${formatUtcLabel(sampled[sampled.length - 1].timestamp)}`,
	);

	if ((params.referenceLines ?? []).length > 0) {
		lines.push(
			`  refs: ${(params.referenceLines ?? [])
				.map(
					(line) =>
						`${line.label}=${formatAxisValue(line.value, params.decimals)}${params.unit}`,
				)
				.join(", ")}`,
		);
	}

	return lines.join("\n");
}

async function fetchMetricSeries(params: {
	cloudWatchClient: CloudWatchClient;
	startTime: Date;
	endTime: Date;
	periodSeconds: number;
}): Promise<Map<string, MetricSeries>> {
	const queries: MetricDataQuery[] = [
		{
			Id: "send",
			MetricStat: {
				Metric: { Namespace: "AWS/SES", MetricName: "Send", Dimensions: [] },
				Period: params.periodSeconds,
				Stat: "Sum",
			},
		},
		{
			Id: "reject",
			MetricStat: {
				Metric: { Namespace: "AWS/SES", MetricName: "Reject", Dimensions: [] },
				Period: params.periodSeconds,
				Stat: "Sum",
			},
		},
		{
			Id: "bounce",
			MetricStat: {
				Metric: { Namespace: "AWS/SES", MetricName: "Bounce", Dimensions: [] },
				Period: params.periodSeconds,
				Stat: "Sum",
			},
		},
		{
			Id: "repbouncerate",
			MetricStat: {
				Metric: {
					Namespace: "AWS/SES",
					MetricName: "Reputation.BounceRate",
					Dimensions: [],
				},
				Period: params.periodSeconds,
				Stat: "Average",
			},
		},
		{
			Id: "repcomplaintrate",
			MetricStat: {
				Metric: {
					Namespace: "AWS/SES",
					MetricName: "Reputation.ComplaintRate",
					Dimensions: [],
				},
				Period: params.periodSeconds,
				Stat: "Average",
			},
		},
		{
			Id: "complaint",
			MetricStat: {
				Metric: { Namespace: "AWS/SES", MetricName: "Complaint", Dimensions: [] },
				Period: params.periodSeconds,
				Stat: "Sum",
			},
		},
		{ Id: "rejectrate", Expression: "IF(send > 0, reject / send * 100, 0)" },
		{ Id: "bouncerate", Expression: "IF(send > 0, bounce / send * 100, 0)" },
		{
			Id: "complaintrate",
			Expression: "IF(send > 0, complaint / send * 100, 0)",
		},
	];

	const merged = new Map<string, MetricSeries>();
	let nextToken: string | undefined;
	do {
		const response = await withAwsRetry("GetMetricData", async () =>
			params.cloudWatchClient.send(
				new GetMetricDataCommand({
					StartTime: params.startTime,
					EndTime: params.endTime,
					MetricDataQueries: queries,
					ScanBy: "TimestampAscending",
					NextToken: nextToken,
				}),
			),
		);
		for (const result of response.MetricDataResults ?? []) {
			if (!result.Id) {
				continue;
			}
			const current = merged.get(result.Id) ?? {
				id: result.Id,
				values: [],
				timestamps: [],
			};
			const values = result.Values ?? [];
			const timestamps = result.Timestamps ?? [];
			for (let index = 0; index < values.length; index++) {
				const value = values[index];
				if (!Number.isFinite(value)) {
					continue;
				}
				const timestamp = timestamps[index] ?? null;
				current.values.push(value);
				current.timestamps.push(
					timestamp instanceof Date ? timestamp : new Date(0),
				);
			}
			merged.set(result.Id, current);
		}
		nextToken = response.NextToken;
	} while (nextToken);

	return merged;
}

export async function getAwsSesStats(params: {
	lookbackDays: number;
	periodSeconds: number;
	region?: string;
}): Promise<AwsStatsResult> {
	const awsRegion = params.region || process.env.AWS_REGION || "us-east-2";
	const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
	if (!awsAccessKeyId || !awsSecretAccessKey) {
		throw new Error(
			"Missing AWS credentials. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
		);
	}

	const sesClient = new SESv2Client({
		region: awsRegion,
		credentials: {
			accessKeyId: awsAccessKeyId,
			secretAccessKey: awsSecretAccessKey,
		},
	});
	const cloudWatchClient = new CloudWatchClient({
		region: awsRegion,
		credentials: {
			accessKeyId: awsAccessKeyId,
			secretAccessKey: awsSecretAccessKey,
		},
	});

	const endTime = new Date();
	const startTime = new Date(
		endTime.getTime() - params.lookbackDays * 24 * 60 * 60 * 1_000,
	);

	const [account, series] = await Promise.all([
		withAwsRetry("GetAccount", async () =>
			sesClient.send(new GetAccountCommand({})),
		),
		fetchMetricSeries({
			cloudWatchClient,
			startTime,
			endTime,
			periodSeconds: params.periodSeconds,
		}),
	]);

	const sentLast24Hours = account.SendQuota?.SentLast24Hours ?? 0;
	const max24HourSend = account.SendQuota?.Max24HourSend ?? 0;
	const maxSendRate = account.SendQuota?.MaxSendRate ?? 0;
	const remainingSends = Math.max(0, max24HourSend - sentLast24Hours);
	const sendingQuotaUsedPercent =
		max24HourSend > 0 ? (sentLast24Hours / max24HourSend) * 100 : 0;

	const sends = sum(series.get("send")?.values ?? []);
	const rejects = sum(series.get("reject")?.values ?? []);
	const bounces = sum(series.get("bounce")?.values ?? []);
	const complaints = sum(series.get("complaint")?.values ?? []);

	const reputationBounceRatePoints = scaleTimePoints(
		toTimePoints(series.get("repbouncerate")),
		100,
	);
	const reputationComplaintRatePoints = scaleTimePoints(
		toTimePoints(series.get("repcomplaintrate")),
		100,
	);

	const rejectRatePercent = sends > 0 ? (rejects / sends) * 100 : 0;
	const observedBounceRatePercent = sends > 0 ? (bounces / sends) * 100 : 0;
	const observedComplaintRatePercent = sends > 0 ? (complaints / sends) * 100 : 0;
	const historicBounceRatePercent =
		reputationBounceRatePoints.length > 0
			? average(reputationBounceRatePoints.map((point) => point.value))
			: observedBounceRatePercent;
	const historicComplaintRatePercent =
		reputationComplaintRatePoints.length > 0
			? average(reputationComplaintRatePoints.map((point) => point.value))
			: observedComplaintRatePercent;

	const latestRejectRatePercent = getLatestValue(series.get("rejectrate"));
	const latestBounceRatePercent =
		reputationBounceRatePoints.length > 0
			? getLatestValue(series.get("repbouncerate")) * 100
			: getLatestValue(series.get("bouncerate"));
	const latestComplaintRatePercent =
		reputationComplaintRatePoints.length > 0
			? getLatestValue(series.get("repcomplaintrate")) * 100
			: getLatestValue(series.get("complaintrate"));

	const peakSendsInPeriod = max(series.get("send")?.values ?? []);

	const bounceWarningThresholdPercent = 5;
	const bounceAtRiskThresholdPercent = 10;
	const complaintWarningThresholdPercent = 0.1;
	const complaintAtRiskThresholdPercent = 0.5;

	const bounceStatus = getReputationStatus(
		historicBounceRatePercent,
		bounceWarningThresholdPercent,
		bounceAtRiskThresholdPercent,
	);
	const complaintStatus = getReputationStatus(
		historicComplaintRatePercent,
		complaintWarningThresholdPercent,
		complaintAtRiskThresholdPercent,
	);

	const output: AwsStatsOutput = {
		generatedAt: new Date().toISOString(),
		region: awsRegion,
		window: {
			startTime: startTime.toISOString(),
			endTime: endTime.toISOString(),
			lookbackDays: params.lookbackDays,
			periodSeconds: params.periodSeconds,
		},
		dailyUsage: {
			emailsSentLast24Hours: sentLast24Hours,
			remainingSends,
			sendingQuotaUsedPercent,
			max24HourSend,
			maxSendRate,
		},
		metrics: {
			sends,
			rejects,
			bounces,
			complaints,
			rejectRatePercent,
			observedBounceRatePercent,
			observedComplaintRatePercent,
			historicBounceRatePercent,
			historicComplaintRatePercent,
			historicBounceSource:
				reputationBounceRatePoints.length > 0
					? "Reputation.BounceRate"
					: "derived",
			historicComplaintSource:
				reputationComplaintRatePoints.length > 0
					? "Reputation.ComplaintRate"
					: "derived",
			latestRejectRatePercent,
			latestBounceRatePercent,
			latestComplaintRatePercent,
			peakSendsInPeriod,
			bounceStatus,
			complaintStatus,
			thresholds: {
				bounceWarningPercent: bounceWarningThresholdPercent,
				bounceAtRiskPercent: bounceAtRiskThresholdPercent,
				complaintWarningPercent: complaintWarningThresholdPercent,
				complaintAtRiskPercent: complaintAtRiskThresholdPercent,
			},
		},
	};

	return {
		output,
		series,
		reputationBounceRatePoints,
		reputationComplaintRatePoints,
	};
}

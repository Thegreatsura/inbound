#!/usr/bin/env bun
/**
 * Vercel Logs Security Analysis Script
 *
 * Analyzes Vercel logs CSV export to investigate potential security incidents,
 * particularly focusing on email sending activity and API abuse patterns.
 *
 * Usage:
 *   bun run scripts/analyze-vercel-logs.ts <csv-file-path> [--user <userId>] [--json]
 *
 * Examples:
 *   bun run scripts/analyze-vercel-logs.ts ~/Downloads/logs_result.csv
 *   bun run scripts/analyze-vercel-logs.ts ~/Downloads/logs_result.csv --user iuZY9MJSQwgYvZ96nvop78JBC5kqXj27
 *   bun run scripts/analyze-vercel-logs.ts ~/Downloads/logs_result.csv --json > report.json
 */

import { createReadStream } from "fs";
import { createInterface } from "readline";
import { parseArgs } from "util";

interface LogEntry {
	timeUTC: string;
	timestampInMs: number;
	requestPath: string;
	requestMethod: string;
	requestQueryString: string;
	responseStatusCode: number;
	requestId: string;
	requestUserAgent: string;
	level: string;
	environment: string;
	branch: string;
	vercelCache: string;
	type: string;
	function: string;
	host: string;
	deploymentDomain: string;
	deploymentId: string;
	durationMs: number;
	region: string;
	maxMemoryUsed: number;
	memorySize: number;
	message: string;
	projectId: string;
	traceId: string;
	sessionId: string;
	invocationId: string;
	instanceId: string;
	concurrency: number;
}

interface AnalysisResult {
	summary: {
		totalEntries: number;
		timeRange: { start: string; end: string };
		uniqueRequestIds: number;
		uniqueTraceIds: number;
	};
	apiEndpoints: Record<
		string,
		{
			count: number;
			methods: Record<string, number>;
			statusCodes: Record<string, number>;
		}
	>;
	v2ApiActivity: {
		totalRequests: number;
		sendEmailRequests: number;
		byEndpoint: Record<string, number>;
		byStatusCode: Record<string, number>;
	};
	suspiciousPatterns: {
		highVolumeIPs: Array<{ requestId: string; count: number }>;
		rapidFireRequests: Array<{
			timeWindow: string;
			count: number;
			endpoint: string;
		}>;
		errorSpikes: Array<{
			timeWindow: string;
			errorCount: number;
			errors: string[];
		}>;
		userMentions: Array<{ userId: string; count: number; contexts: string[] }>;
	};
	emailActivity: {
		sentEmails: Array<{ timestamp: string; message: string; traceId: string }>;
		webhookActivity: Array<{
			timestamp: string;
			message: string;
			traceId: string;
		}>;
		fromAddresses: Record<string, number>;
		subjects: Record<string, number>;
	};
	timeline: Array<{
		minute: string;
		requestCount: number;
		v2Requests: number;
		sendRequests: number;
		errors: number;
	}>;
}

function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === "," && !inQuotes) {
			result.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	result.push(current);

	return result;
}

async function analyzeLogFile(
	filePath: string,
	targetUserId?: string,
): Promise<AnalysisResult> {
	const result: AnalysisResult = {
		summary: {
			totalEntries: 0,
			timeRange: { start: "", end: "" },
			uniqueRequestIds: 0,
			uniqueTraceIds: 0,
		},
		apiEndpoints: {},
		v2ApiActivity: {
			totalRequests: 0,
			sendEmailRequests: 0,
			byEndpoint: {},
			byStatusCode: {},
		},
		suspiciousPatterns: {
			highVolumeIPs: [],
			rapidFireRequests: [],
			errorSpikes: [],
			userMentions: [],
		},
		emailActivity: {
			sentEmails: [],
			webhookActivity: [],
			fromAddresses: {},
			subjects: {},
		},
		timeline: [],
	};

	const requestIds = new Set<string>();
	const traceIds = new Set<string>();
	const userMentionMap = new Map<
		string,
		{ count: number; contexts: string[] }
	>();
	const minuteStats = new Map<
		string,
		{ requests: number; v2: number; send: number; errors: number }
	>();

	const fileStream = createReadStream(filePath);
	const rl = createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	});

	let headers: string[] = [];
	let lineNumber = 0;
	let firstTimestamp = "";
	let lastTimestamp = "";

	for await (const line of rl) {
		lineNumber++;

		if (lineNumber === 1) {
			headers = parseCSVLine(line);
			continue;
		}

		const values = parseCSVLine(line);
		if (values.length < headers.length) continue;

		const entry: Partial<LogEntry> = {};
		headers.forEach((header, index) => {
			const key = header as keyof LogEntry;
			const value = values[index];
			if (
				key === "timestampInMs" ||
				key === "responseStatusCode" ||
				key === "durationMs" ||
				key === "maxMemoryUsed" ||
				key === "memorySize" ||
				key === "concurrency"
			) {
				(entry as Record<string, unknown>)[key] = parseInt(value) || 0;
			} else {
				(entry as Record<string, unknown>)[key] = value;
			}
		});

		result.summary.totalEntries++;

		// Track time range
		if (entry.timeUTC) {
			if (!firstTimestamp || entry.timeUTC < firstTimestamp)
				firstTimestamp = entry.timeUTC;
			if (!lastTimestamp || entry.timeUTC > lastTimestamp)
				lastTimestamp = entry.timeUTC;
		}

		// Track unique IDs
		if (entry.requestId) requestIds.add(entry.requestId);
		if (entry.traceId) traceIds.add(entry.traceId);

		// Analyze request path
		const path = entry.requestPath || "";
		const method = entry.requestMethod || "UNKNOWN";
		const status = String(entry.responseStatusCode || 0);

		if (path) {
			// Normalize path (remove host prefix if present)
			const normalizedPath = path.replace(/^[^/]+/, "");

			if (!result.apiEndpoints[normalizedPath]) {
				result.apiEndpoints[normalizedPath] = {
					count: 0,
					methods: {},
					statusCodes: {},
				};
			}
			result.apiEndpoints[normalizedPath].count++;
			result.apiEndpoints[normalizedPath].methods[method] =
				(result.apiEndpoints[normalizedPath].methods[method] || 0) + 1;
			result.apiEndpoints[normalizedPath].statusCodes[status] =
				(result.apiEndpoints[normalizedPath].statusCodes[status] || 0) + 1;

			// Track v2 API activity
			if (path.includes("/v2/") || path.includes("/api/v2")) {
				result.v2ApiActivity.totalRequests++;
				result.v2ApiActivity.byEndpoint[normalizedPath] =
					(result.v2ApiActivity.byEndpoint[normalizedPath] || 0) + 1;
				result.v2ApiActivity.byStatusCode[status] =
					(result.v2ApiActivity.byStatusCode[status] || 0) + 1;

				if (path.includes("send") || path.includes("mail")) {
					result.v2ApiActivity.sendEmailRequests++;
				}
			}
		}

		// Analyze message content for email activity
		const message = entry.message || "";

		// Look for sent email patterns
		if (
			message.includes("sent") ||
			message.includes("sending") ||
			message.includes("SES") ||
			message.includes("mail")
		) {
			result.emailActivity.sentEmails.push({
				timestamp: entry.timeUTC || "",
				message: message.substring(0, 500),
				traceId: entry.traceId || "",
			});
		}

		// Look for webhook activity
		if (message.includes("Webhook") || path.includes("webhook")) {
			result.emailActivity.webhookActivity.push({
				timestamp: entry.timeUTC || "",
				message: message.substring(0, 500),
				traceId: entry.traceId || "",
			});
		}

		// Extract from addresses
		const fromMatch = message.match(/from[:\s]+([^\s,<>]+@[^\s,<>]+)/i);
		if (fromMatch) {
			result.emailActivity.fromAddresses[fromMatch[1]] =
				(result.emailActivity.fromAddresses[fromMatch[1]] || 0) + 1;
		}

		// Extract subjects
		const subjectMatch = message.match(/subject[=:\s]+["']?([^"'\n,]+)/i);
		if (subjectMatch) {
			const subject = subjectMatch[1].trim().substring(0, 100);
			result.emailActivity.subjects[subject] =
				(result.emailActivity.subjects[subject] || 0) + 1;
		}

		// Look for user ID mentions
		const userIdRegex = /[a-zA-Z0-9]{32}/g;
		const userMatches = message.match(userIdRegex) || [];
		for (const userId of userMatches) {
			if (!userMentionMap.has(userId)) {
				userMentionMap.set(userId, { count: 0, contexts: [] });
			}
			const data = userMentionMap.get(userId)!;
			data.count++;
			if (data.contexts.length < 5) {
				data.contexts.push(message.substring(0, 200));
			}
		}

		// If target user specified, look for their activity
		if (targetUserId && message.includes(targetUserId)) {
			console.log(`[${entry.timeUTC}] ${message.substring(0, 200)}`);
		}

		// Timeline stats by minute
		if (entry.timeUTC) {
			const minute = entry.timeUTC.substring(0, 16); // YYYY-MM-DD HH:MM
			if (!minuteStats.has(minute)) {
				minuteStats.set(minute, { requests: 0, v2: 0, send: 0, errors: 0 });
			}
			const stats = minuteStats.get(minute)!;
			stats.requests++;
			if (path.includes("/v2/")) stats.v2++;
			if (path.includes("send") || path.includes("mail")) stats.send++;
			if (parseInt(status) >= 400) stats.errors++;
		}
	}

	// Finalize results
	result.summary.timeRange = { start: firstTimestamp, end: lastTimestamp };
	result.summary.uniqueRequestIds = requestIds.size;
	result.summary.uniqueTraceIds = traceIds.size;

	// Process user mentions
	result.suspiciousPatterns.userMentions = Array.from(userMentionMap.entries())
		.map(([userId, data]) => ({
			userId,
			count: data.count,
			contexts: data.contexts,
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, 20);

	// Build timeline
	result.timeline = Array.from(minuteStats.entries())
		.map(([minute, stats]) => ({
			minute,
			requestCount: stats.requests,
			v2Requests: stats.v2,
			sendRequests: stats.send,
			errors: stats.errors,
		}))
		.sort((a, b) => a.minute.localeCompare(b.minute));

	// Identify rapid fire patterns
	for (const [minute, stats] of minuteStats) {
		if (stats.requests > 100) {
			result.suspiciousPatterns.rapidFireRequests.push({
				timeWindow: minute,
				count: stats.requests,
				endpoint: "multiple",
			});
		}
	}

	return result;
}

function printReport(result: AnalysisResult, jsonOutput: boolean) {
	if (jsonOutput) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	console.log("\n" + "=".repeat(60));
	console.log("           VERCEL LOGS SECURITY ANALYSIS REPORT");
	console.log("=".repeat(60));

	console.log("\n## Summary");
	console.log(
		`Total log entries: ${result.summary.totalEntries.toLocaleString()}`,
	);
	console.log(
		`Time range: ${result.summary.timeRange.start} to ${result.summary.timeRange.end}`,
	);
	console.log(
		`Unique request IDs: ${result.summary.uniqueRequestIds.toLocaleString()}`,
	);
	console.log(
		`Unique trace IDs: ${result.summary.uniqueTraceIds.toLocaleString()}`,
	);

	console.log("\n## V2 API Activity (Potential Compromise Vector)");
	console.log(
		`Total v2 requests: ${result.v2ApiActivity.totalRequests.toLocaleString()}`,
	);
	console.log(
		`Send email requests: ${result.v2ApiActivity.sendEmailRequests.toLocaleString()}`,
	);

	if (Object.keys(result.v2ApiActivity.byEndpoint).length > 0) {
		console.log("\nV2 Endpoints accessed:");
		const sortedEndpoints = Object.entries(result.v2ApiActivity.byEndpoint)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);
		for (const [endpoint, count] of sortedEndpoints) {
			console.log(`  ${endpoint}: ${count.toLocaleString()}`);
		}
	}

	if (Object.keys(result.v2ApiActivity.byStatusCode).length > 0) {
		console.log("\nV2 Status codes:");
		for (const [code, count] of Object.entries(
			result.v2ApiActivity.byStatusCode,
		)) {
			console.log(`  ${code}: ${count.toLocaleString()}`);
		}
	}

	console.log("\n## Top API Endpoints (All)");
	const sortedEndpoints = Object.entries(result.apiEndpoints)
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, 15);
	for (const [endpoint, data] of sortedEndpoints) {
		const methods = Object.keys(data.methods).join(",");
		console.log(`  [${methods}] ${endpoint}: ${data.count.toLocaleString()}`);
	}

	console.log("\n## Email Activity");
	console.log(
		`Sent email log entries: ${result.emailActivity.sentEmails.length.toLocaleString()}`,
	);
	console.log(
		`Webhook activity entries: ${result.emailActivity.webhookActivity.length.toLocaleString()}`,
	);

	if (Object.keys(result.emailActivity.fromAddresses).length > 0) {
		console.log("\nFrom addresses detected in logs:");
		const sortedFroms = Object.entries(result.emailActivity.fromAddresses)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);
		for (const [from, count] of sortedFroms) {
			console.log(`  ${from}: ${count.toLocaleString()}`);
		}
	}

	if (Object.keys(result.emailActivity.subjects).length > 0) {
		console.log("\nSubjects detected in logs:");
		const sortedSubjects = Object.entries(result.emailActivity.subjects)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);
		for (const [subject, count] of sortedSubjects) {
			console.log(`  "${subject}": ${count.toLocaleString()}`);
		}
	}

	console.log("\n## Suspicious Patterns");

	if (result.suspiciousPatterns.rapidFireRequests.length > 0) {
		console.log("\n⚠️  High-volume request windows:");
		for (const pattern of result.suspiciousPatterns.rapidFireRequests.slice(
			0,
			10,
		)) {
			console.log(
				`  ${pattern.timeWindow}: ${pattern.count.toLocaleString()} requests`,
			);
		}
	}

	if (result.suspiciousPatterns.userMentions.length > 0) {
		console.log("\n👤 User IDs mentioned in logs:");
		for (const mention of result.suspiciousPatterns.userMentions.slice(0, 10)) {
			console.log(
				`  ${mention.userId}: ${mention.count.toLocaleString()} mentions`,
			);
		}
	}

	console.log("\n## Timeline (requests per minute)");
	const significantMinutes = result.timeline.filter(
		(t) => t.requestCount > 50 || t.v2Requests > 0 || t.sendRequests > 0,
	);
	if (significantMinutes.length > 0) {
		console.log("Minute                | Total | V2    | Send  | Errors");
		console.log("-".repeat(60));
		for (const t of significantMinutes.slice(-30)) {
			console.log(
				`${t.minute} | ${t.requestCount.toString().padStart(5)} | ${t.v2Requests.toString().padStart(5)} | ${t.sendRequests.toString().padStart(5)} | ${t.errors.toString().padStart(6)}`,
			);
		}
	} else {
		console.log("No significant activity detected in timeline.");
	}

	console.log("\n" + "=".repeat(60));
	console.log("                    END OF REPORT");
	console.log("=".repeat(60) + "\n");
}

async function main() {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		options: {
			user: { type: "string", short: "u" },
			json: { type: "boolean", short: "j", default: false },
			help: { type: "boolean", short: "h", default: false },
		},
		allowPositionals: true,
	});

	if (values.help || positionals.length === 0) {
		console.log(`
Vercel Logs Security Analysis Script

Usage:
  bun run scripts/analyze-vercel-logs.ts <csv-file-path> [options]

Options:
  -u, --user <userId>   Filter and highlight activity for specific user ID
  -j, --json            Output results as JSON
  -h, --help            Show this help message

Examples:
  bun run scripts/analyze-vercel-logs.ts ~/Downloads/logs_result.csv
  bun run scripts/analyze-vercel-logs.ts ~/Downloads/logs_result.csv --user iuZY9MJSQwgYvZ96nvop78JBC5kqXj27
  bun run scripts/analyze-vercel-logs.ts ~/Downloads/logs_result.csv --json > report.json
`);
		process.exit(0);
	}

	const filePath = positionals[0];
	const targetUserId = values.user;
	const jsonOutput = values.json ?? false;

	if (!jsonOutput) {
		console.log(`\nAnalyzing log file: ${filePath}`);
		if (targetUserId) {
			console.log(`Filtering for user: ${targetUserId}`);
		}
		console.log("Processing...\n");
	}

	try {
		const result = await analyzeLogFile(filePath, targetUserId);
		printReport(result, jsonOutput);
	} catch (error) {
		console.error("Error analyzing log file:", error);
		process.exit(1);
	}
}

main();

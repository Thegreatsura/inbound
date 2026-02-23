"use client";

import { Loader2Icon, RefreshCcwIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type TenantInsight = {
	id: string;
	awsTenantId: string;
	tenantName: string;
	configurationSetName: string | null;
	status: string;
	reputationPolicy: string;
	createdAt: string | null;
	updatedAt: string | null;
	user: {
		id: string;
		name: string | null;
		email: string | null;
		banned: boolean | null;
	};
	domains: Array<{
		id: string;
		domain: string;
		status: string;
		canReceiveEmails: boolean | null;
	}>;
	stats: {
		timeRange: string;
		sent: number;
		failedSends: number;
		bounces: number;
		complaints: number;
		deliveryFailures: number;
		bounceRate: number;
		complaintRate: number;
		uniqueFailedRecipients: number;
		lastSentAt: string | null;
		lastDeliveryEventAt: string | null;
		topRejectedRecipientDomains: Array<{
			domain: string;
			count: number;
		}>;
	};
	risk: {
		score: number;
		flags: string[];
		suspicious: boolean;
	};
};

type TenantInsightsResponse = {
	data: TenantInsight[];
	summary: {
		scannedTenants: number;
		flaggedTenants: number;
		totalSent: number;
		totalFailedSends: number;
		totalBounces: number;
		totalComplaints: number;
		totalDeliveryFailures: number;
		bounceRateOverall: number;
		complaintRateOverall: number;
	};
	pagination: {
		limit: number;
		offset: number;
		total: number;
		hasMore: boolean;
	};
};

type TenantInsightsPanelProps = {
	hasCredentials: boolean;
	inboundRequest: (path: string, init?: RequestInit) => Promise<unknown>;
	onUsePauseTenant: (tenantId: string) => void;
	onUseIdentity: (tenantId: string, identity: string) => void;
};

function formatDate(value: string | null): string {
	if (!value) {
		return "-";
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toLocaleString();
}

function formatInt(value: number): string {
	return value.toLocaleString();
}

function buildIssueSummary(tenant: TenantInsight): string {
	const parts: string[] = [];

	if (tenant.stats.bounceRate >= 5) {
		parts.push(`Bounce rate ${tenant.stats.bounceRate.toFixed(2)}%`);
	}

	if (tenant.stats.bounces >= 50) {
		parts.push(`${formatInt(tenant.stats.bounces)} bounces`);
	}

	if (tenant.stats.failedSends >= 20) {
		parts.push(`${formatInt(tenant.stats.failedSends)} failed sends`);
	}

	if (tenant.stats.complaints > 0) {
		parts.push(
			`${formatInt(tenant.stats.complaints)} complaints (${tenant.stats.complaintRate.toFixed(2)}%)`,
		);
	}

	if (tenant.stats.uniqueFailedRecipients >= 100) {
		parts.push(
			`${formatInt(tenant.stats.uniqueFailedRecipients)} unique failed recipients`,
		);
	}

	if (tenant.user.banned) {
		parts.push("User is banned");
	}

	if (tenant.status !== "active") {
		parts.push(`Tenant status is ${tenant.status}`);
	}

	if (tenant.stats.topRejectedRecipientDomains.length > 0) {
		const topDomains = tenant.stats.topRejectedRecipientDomains
			.slice(0, 2)
			.map((item) => `${item.domain} (${formatInt(item.count)})`)
			.join(", ");
		parts.push(`Top recipient rejections: ${topDomains}`);
	}

	if (parts.length === 0) {
		return "No major risk signals in selected window";
	}

	return parts.join(" | ");
}

function getDisplayAccount(tenant: TenantInsight): string {
	if (tenant.user.email) {
		return tenant.user.email;
	}

	if (tenant.user.name) {
		return tenant.user.name;
	}

	return tenant.user.id;
}

export function TenantInsightsPanel({
	hasCredentials,
	inboundRequest,
	onUsePauseTenant,
	onUseIdentity,
}: TenantInsightsPanelProps) {
	const [search, setSearch] = useState("");
	const [timeRange, setTimeRange] = useState("7d");
	const [sortBy, setSortBy] = useState("risk");
	const [sortOrder, setSortOrder] = useState("desc");
	const [flaggedOnly, setFlaggedOnly] = useState("true");

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<TenantInsightsResponse | null>(null);

	async function loadInsights() {
		setLoading(true);
		setError(null);

		try {
			const query = new URLSearchParams();
			query.set("limit", "100");
			query.set("offset", "0");
			query.set("timeRange", timeRange);
			query.set("sortBy", sortBy);
			query.set("sortOrder", sortOrder);
			query.set("flaggedOnly", flaggedOnly);

			if (search.trim().length > 0) {
				query.set("search", search.trim());
			}

			const response = (await inboundRequest(
				`admin/tenants?${query.toString()}`,
			)) as TenantInsightsResponse;

			setResult(response);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Failed to load tenant insights",
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Tenant Risk Panel</CardTitle>
				<CardDescription>
					Focused incident view across tenants, users, domains, and delivery
					outcomes.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-3 lg:grid-cols-6">
					<Input
						className="lg:col-span-2"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search tenant, user, domain, or AWS tenant id"
					/>
					<Select value={timeRange} onValueChange={setTimeRange}>
						<SelectTrigger>
							<SelectValue placeholder="Time range" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="24h">24h</SelectItem>
							<SelectItem value="7d">7d</SelectItem>
							<SelectItem value="30d">30d</SelectItem>
						</SelectContent>
					</Select>
					<Select value={sortBy} onValueChange={setSortBy}>
						<SelectTrigger>
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="risk">Risk score</SelectItem>
							<SelectItem value="bounce_rate">Bounce rate</SelectItem>
							<SelectItem value="complaint_rate">Complaint rate</SelectItem>
							<SelectItem value="sent">Sent volume</SelectItem>
							<SelectItem value="newest">Newest tenant</SelectItem>
						</SelectContent>
					</Select>
					<Select value={sortOrder} onValueChange={setSortOrder}>
						<SelectTrigger>
							<SelectValue placeholder="Sort order" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="desc">Descending</SelectItem>
							<SelectItem value="asc">Ascending</SelectItem>
						</SelectContent>
					</Select>
					<Select value={flaggedOnly} onValueChange={setFlaggedOnly}>
						<SelectTrigger>
							<SelectValue placeholder="Scope" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="true">Flagged only</SelectItem>
							<SelectItem value="false">All tenants</SelectItem>
						</SelectContent>
					</Select>
					<Button
						variant="secondary"
						onClick={() => {
							void loadInsights();
						}}
						disabled={!hasCredentials || loading}
					>
						{loading ? (
							<Loader2Icon data-icon="inline-start" className="animate-spin" />
						) : (
							<RefreshCcwIcon data-icon="inline-start" />
						)}
						Refresh
					</Button>
				</div>

				{!hasCredentials ? (
					<p className="text-muted-foreground mt-3 text-xs/relaxed">
						Save credentials first to run tenant risk analysis.
					</p>
				) : null}

				{error ? (
					<p className="text-destructive mt-3 text-xs/relaxed">{error}</p>
				) : null}

				{result ? (
					<>
						<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
							<div className="bg-card rounded-md border p-3">
								<p className="text-muted-foreground text-[11px]">
									Scanned tenants
								</p>
								<p className="text-sm font-medium">
									{formatInt(result.summary.scannedTenants)}
								</p>
							</div>
							<div className="bg-card rounded-md border p-3">
								<p className="text-muted-foreground text-[11px]">
									Flagged tenants
								</p>
								<p className="text-sm font-medium">
									{formatInt(result.summary.flaggedTenants)}
								</p>
							</div>
							<div className="bg-card rounded-md border p-3">
								<p className="text-muted-foreground text-[11px]">Sent emails</p>
								<p className="text-sm font-medium">
									{formatInt(result.summary.totalSent)}
								</p>
							</div>
							<div className="bg-card rounded-md border p-3">
								<p className="text-muted-foreground text-[11px]">Bounces</p>
								<p className="text-sm font-medium">
									{formatInt(result.summary.totalBounces)}
								</p>
							</div>
							<div className="bg-card rounded-md border p-3">
								<p className="text-muted-foreground text-[11px]">Bounce rate</p>
								<p className="text-sm font-medium">
									{result.summary.bounceRateOverall.toFixed(2)}%
								</p>
							</div>
							<div className="bg-card rounded-md border p-3">
								<p className="text-muted-foreground text-[11px]">
									Complaint rate
								</p>
								<p className="text-sm font-medium">
									{result.summary.complaintRateOverall.toFixed(2)}%
								</p>
							</div>
						</div>

						<div className="mt-4 overflow-x-auto rounded-md border">
							<table className="w-full min-w-[1200px] text-xs/relaxed">
								<thead className="bg-muted/40 text-muted-foreground">
									<tr>
										<th className="px-3 py-2 text-left font-medium">Account</th>
										<th className="px-3 py-2 text-left font-medium">Domains</th>
										<th className="px-3 py-2 text-right font-medium">Sent</th>
										<th className="px-3 py-2 text-right font-medium">Failed</th>
										<th className="px-3 py-2 text-right font-medium">
											Bounces
										</th>
										<th className="px-3 py-2 text-right font-medium">
											Bounce %
										</th>
										<th className="px-3 py-2 text-right font-medium">
											Complaints
										</th>
										<th className="px-3 py-2 text-left font-medium">
											Last activity
										</th>
										<th className="px-3 py-2 text-left font-medium">
											Incident summary
										</th>
										<th className="px-3 py-2 text-left font-medium">Actions</th>
									</tr>
								</thead>
								<tbody>
									{result.data.length === 0 ? (
										<tr>
											<td
												colSpan={10}
												className="text-muted-foreground px-3 py-6 text-center"
											>
												No tenant insights match this filter.
											</td>
										</tr>
									) : (
										result.data.map((tenant) => {
											const firstDomainIdentity =
												tenant.domains[0]?.domain || "";
											const domainsText =
												tenant.domains.length > 0
													? tenant.domains
															.map((domain) => domain.domain)
															.join(", ")
													: "-";
											const rowClassName = tenant.risk.suspicious
												? "border-t bg-destructive/5"
												: "border-t";

											return (
												<tr key={tenant.id} className={rowClassName}>
													<td className="px-3 py-2 align-top">
														<p className="text-sm font-medium">
															{getDisplayAccount(tenant)}
														</p>
														<p className="text-muted-foreground">
															{tenant.tenantName} | {tenant.status}
															{tenant.user.banned ? " | user banned" : ""}
														</p>
														<p className="text-muted-foreground">
															Tenant ID: {tenant.id}
														</p>
													</td>
													<td className="px-3 py-2 align-top">{domainsText}</td>
													<td className="px-3 py-2 text-right align-top">
														{formatInt(tenant.stats.sent)}
													</td>
													<td className="px-3 py-2 text-right align-top">
														{formatInt(tenant.stats.failedSends)}
													</td>
													<td className="px-3 py-2 text-right align-top">
														{formatInt(tenant.stats.bounces)}
													</td>
													<td className="px-3 py-2 text-right align-top">
														{tenant.stats.bounceRate.toFixed(2)}%
													</td>
													<td className="px-3 py-2 text-right align-top">
														{formatInt(tenant.stats.complaints)}
													</td>
													<td className="px-3 py-2 align-top">
														<p className="text-muted-foreground">
															Last sent: {formatDate(tenant.stats.lastSentAt)}
														</p>
														<p className="text-muted-foreground">
															Last event:{" "}
															{formatDate(tenant.stats.lastDeliveryEventAt)}
														</p>
													</td>
													<td className="px-3 py-2 align-top">
														{buildIssueSummary(tenant)}
													</td>
													<td className="px-3 py-2 align-top">
														<div className="flex flex-col gap-2">
															<Button
																variant="outline"
																size="sm"
																onClick={() => onUsePauseTenant(tenant.id)}
															>
																Use in pause action
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	onUseIdentity(tenant.id, firstDomainIdentity)
																}
																disabled={!firstDomainIdentity}
															>
																Use first domain for identity delete
															</Button>
														</div>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</>
				) : null}
			</CardContent>
		</Card>
	);
}

"use client";

import { AlertTriangleIcon, Loader2Icon, RefreshCcwIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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

function riskBadgeVariant(
	score: number,
): "destructive" | "secondary" | "outline" {
	if (score >= 70) {
		return "destructive";
	}

	if (score >= 40) {
		return "secondary";
	}

	return "outline";
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
					Link tenants, users, domains, and delivery outcomes to spot abuse.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-3 lg:grid-cols-6">
					<Input
						className="lg:col-span-2"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search tenant, user, or AWS tenant id"
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
						<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
							<div className="bg-card rounded-md border p-3">
								<p className="text-muted-foreground text-[11px]">
									Scanned tenants
								</p>
								<p className="text-sm font-medium">
									{result.summary.scannedTenants}
								</p>
							</div>
							<div className="bg-card rounded-md border p-3">
								<p className="text-muted-foreground text-[11px]">
									Flagged tenants
								</p>
								<p className="text-sm font-medium">
									{result.summary.flaggedTenants}
								</p>
							</div>
							<div className="bg-card rounded-md border p-3">
								<p className="text-muted-foreground text-[11px]">Sent emails</p>
								<p className="text-sm font-medium">
									{result.summary.totalSent}
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

						<div className="mt-4 grid gap-3">
							{result.data.length === 0 ? (
								<div className="text-muted-foreground rounded-md border border-dashed p-4 text-xs/relaxed">
									No tenant insights match this filter.
								</div>
							) : (
								result.data.map((tenant) => {
									const firstDomainIdentity = tenant.domains[0]?.domain || "";

									return (
										<div
											key={tenant.id}
											className="bg-card rounded-md border p-3"
										>
											<div className="mb-2 flex flex-wrap items-center gap-2">
												<Badge variant={riskBadgeVariant(tenant.risk.score)}>
													Risk {tenant.risk.score}
												</Badge>
												<Badge
													variant={
														tenant.status === "active" ? "secondary" : "outline"
													}
												>
													{tenant.status}
												</Badge>
												{tenant.user.banned ? (
													<Badge variant="destructive">User banned</Badge>
												) : null}
												<Badge variant="outline">Tenant ID: {tenant.id}</Badge>
												<Badge variant="outline">
													AWS: {tenant.awsTenantId}
												</Badge>
											</div>

											<div className="grid gap-3 xl:grid-cols-2">
												<div className="space-y-2">
													<p className="text-sm font-medium">
														{tenant.tenantName}
													</p>
													<p className="text-muted-foreground text-xs/relaxed">
														User: {tenant.user.name || "-"} (
														{tenant.user.email || "-"})
													</p>
													<p className="text-muted-foreground text-xs/relaxed">
														Created: {formatDate(tenant.createdAt)}
													</p>
													<div className="flex flex-wrap gap-1">
														{tenant.domains.length === 0 ? (
															<Badge variant="outline">No domains linked</Badge>
														) : (
															tenant.domains.map((domain) => (
																<Badge key={domain.id} variant="outline">
																	{domain.domain}
																</Badge>
															))
														)}
													</div>
												</div>

												<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
													<div className="rounded-md border px-2 py-1.5">
														<p className="text-muted-foreground text-[11px]">
															Sent
														</p>
														<p className="text-sm font-medium">
															{tenant.stats.sent}
														</p>
													</div>
													<div className="rounded-md border px-2 py-1.5">
														<p className="text-muted-foreground text-[11px]">
															Failed sends
														</p>
														<p className="text-sm font-medium">
															{tenant.stats.failedSends}
														</p>
													</div>
													<div className="rounded-md border px-2 py-1.5">
														<p className="text-muted-foreground text-[11px]">
															Bounces
														</p>
														<p className="text-sm font-medium">
															{tenant.stats.bounces}
														</p>
													</div>
													<div className="rounded-md border px-2 py-1.5">
														<p className="text-muted-foreground text-[11px]">
															Complaints
														</p>
														<p className="text-sm font-medium">
															{tenant.stats.complaints}
														</p>
													</div>
													<div className="rounded-md border px-2 py-1.5">
														<p className="text-muted-foreground text-[11px]">
															Bounce rate
														</p>
														<p className="text-sm font-medium">
															{tenant.stats.bounceRate.toFixed(2)}%
														</p>
													</div>
													<div className="rounded-md border px-2 py-1.5">
														<p className="text-muted-foreground text-[11px]">
															Complaint rate
														</p>
														<p className="text-sm font-medium">
															{tenant.stats.complaintRate.toFixed(2)}%
														</p>
													</div>
												</div>
											</div>

											<div className="mt-2 flex flex-wrap gap-1">
												{tenant.risk.flags.length === 0 ? (
													<Badge variant="outline">No risk flags</Badge>
												) : (
													tenant.risk.flags.map((flag) => (
														<Badge key={flag} variant="secondary">
															<AlertTriangleIcon data-icon="inline-start" />
															{flag}
														</Badge>
													))
												)}
											</div>

											{tenant.stats.topRejectedRecipientDomains.length > 0 ? (
												<div className="mt-2 flex flex-wrap gap-1">
													{tenant.stats.topRejectedRecipientDomains.map(
														(item) => (
															<Badge
																key={`${tenant.id}-${item.domain}`}
																variant="outline"
															>
																{item.domain} ({item.count})
															</Badge>
														),
													)}
												</div>
											) : null}

											<div className="mt-3 flex flex-wrap gap-2">
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
										</div>
									);
								})
							)}
						</div>
					</>
				) : null}
			</CardContent>
		</Card>
	);
}

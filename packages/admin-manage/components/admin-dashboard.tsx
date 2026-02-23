"use client";

import {
	Loader2Icon,
	PauseCircleIcon,
	RefreshCcwIcon,
	SaveIcon,
	SearchIcon,
	ShieldXIcon,
	Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TenantInsightsPanel } from "@/components/tenant-insights-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const API_KEY_STORAGE_KEY = "admin-manage.inbound-api-key";
const BASE_URL_STORAGE_KEY = "admin-manage.inbound-base-url";
const DEFAULT_BASE_URL = "https://inbound.new/api/e2";

type BlockedSignupDomain = {
	id: string;
	domain: string;
	reason: string | null;
	isActive: boolean;
	blockedBy: string | null;
	createdAt: string | null;
	updatedAt: string | null;
};

type BlockedSignupDomainDraft = {
	domain: string;
	reason: string;
	isActive: boolean;
};

type ListBlockedSignupDomainsResponse = {
	data: BlockedSignupDomain[];
	pagination: {
		limit: number;
		offset: number;
		total: number;
		hasMore: boolean;
	};
};

function parseMaybeJson(raw: string): unknown {
	if (!raw) {
		return null;
	}

	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return raw;
	}
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
	if (typeof payload === "string" && payload.trim().length > 0) {
		return payload;
	}

	if (payload && typeof payload === "object") {
		const errorPayload = payload as { error?: string; message?: string };
		if (errorPayload.error) {
			return errorPayload.error;
		}

		if (errorPayload.message) {
			return errorPayload.message;
		}
	}

	return fallback;
}

function formatDate(value: string | null): string {
	if (!value) {
		return "-";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString();
}

function createDraftFromDomain(
	blockedDomain: BlockedSignupDomain,
): BlockedSignupDomainDraft {
	return {
		domain: blockedDomain.domain,
		reason: blockedDomain.reason ?? "",
		isActive: blockedDomain.isActive,
	};
}

export function AdminDashboard() {
	const [apiKey, setApiKey] = useState("");
	const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
	const [credentialStatus, setCredentialStatus] = useState<string | null>(null);

	const [blockedDomains, setBlockedDomains] = useState<BlockedSignupDomain[]>(
		[],
	);
	const [blockedDomainDrafts, setBlockedDomainDrafts] = useState<
		Record<string, BlockedSignupDomainDraft>
	>({});
	const [blockedListLoading, setBlockedListLoading] = useState(false);
	const [blockedListError, setBlockedListError] = useState<string | null>(null);
	const [blockedSearch, setBlockedSearch] = useState("");

	const [newDomain, setNewDomain] = useState("");
	const [newReason, setNewReason] = useState("");
	const [newActive, setNewActive] = useState("true");
	const [createBlockedLoading, setCreateBlockedLoading] = useState(false);
	const [createBlockedStatus, setCreateBlockedStatus] = useState<string | null>(
		null,
	);

	const [saveBlockedId, setSaveBlockedId] = useState<string | null>(null);
	const [deleteBlockedId, setDeleteBlockedId] = useState<string | null>(null);

	const [lookupBlockedId, setLookupBlockedId] = useState("");
	const [lookupBlockedLoading, setLookupBlockedLoading] = useState(false);
	const [lookupBlockedResult, setLookupBlockedResult] = useState<unknown>(null);
	const [lookupBlockedError, setLookupBlockedError] = useState<string | null>(
		null,
	);

	const [pauseTenantId, setPauseTenantId] = useState("");
	const [pauseReason, setPauseReason] = useState("");
	const [pauseLoading, setPauseLoading] = useState(false);
	const [pauseResult, setPauseResult] = useState<unknown>(null);
	const [pauseError, setPauseError] = useState<string | null>(null);

	const [identityTenantId, setIdentityTenantId] = useState("");
	const [identityValue, setIdentityValue] = useState("");
	const [deleteIdentityLoading, setDeleteIdentityLoading] = useState(false);
	const [deleteIdentityResult, setDeleteIdentityResult] =
		useState<unknown>(null);
	const [deleteIdentityError, setDeleteIdentityError] = useState<string | null>(
		null,
	);

	const hasCredentials = useMemo(
		() => apiKey.trim().length > 0 && baseUrl.trim().length > 0,
		[apiKey, baseUrl],
	);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const savedApiKey = window.localStorage.getItem(API_KEY_STORAGE_KEY);
		const savedBaseUrl = window.localStorage.getItem(BASE_URL_STORAGE_KEY);

		if (savedApiKey) {
			setApiKey(savedApiKey);
		}

		if (savedBaseUrl) {
			setBaseUrl(savedBaseUrl);
		}
	}, []);

	async function inboundRequest<T>(
		path: string,
		init?: RequestInit,
	): Promise<T> {
		const trimmedApiKey = apiKey.trim();
		const trimmedBaseUrl = baseUrl.trim();

		if (!trimmedApiKey) {
			throw new Error("Set an Inbound API key first");
		}

		if (!trimmedBaseUrl) {
			throw new Error("Set an API base URL first");
		}

		const headers = new Headers(init?.headers);
		headers.set("x-inbound-api-key", trimmedApiKey);
		headers.set("x-inbound-base-url", trimmedBaseUrl);

		if (init?.body && !headers.has("content-type")) {
			headers.set("content-type", "application/json");
		}

		const response = await fetch(`/api/inbound/${path}`, {
			...init,
			headers,
			cache: "no-store",
		});

		const rawBody = await response.text();
		const parsedBody = parseMaybeJson(rawBody);

		if (!response.ok) {
			throw new Error(
				getApiErrorMessage(
					parsedBody,
					`Request failed (${response.status} ${response.statusText})`,
				),
			);
		}

		return parsedBody as T;
	}

	function saveCredentials() {
		if (typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
		window.localStorage.setItem(BASE_URL_STORAGE_KEY, baseUrl.trim());
		setCredentialStatus("Credentials saved in local storage");
	}

	function clearCredentials() {
		if (typeof window === "undefined") {
			return;
		}

		window.localStorage.removeItem(API_KEY_STORAGE_KEY);
		window.localStorage.removeItem(BASE_URL_STORAGE_KEY);
		setApiKey("");
		setBaseUrl(DEFAULT_BASE_URL);
		setCredentialStatus("Cleared saved credentials");
	}

	async function loadBlockedDomains() {
		setBlockedListLoading(true);
		setBlockedListError(null);

		try {
			const query = new URLSearchParams();
			query.set("limit", "100");
			if (blockedSearch.trim().length > 0) {
				query.set("search", blockedSearch.trim());
			}

			const response = await inboundRequest<ListBlockedSignupDomainsResponse>(
				`admin/blocked-signup-domains?${query.toString()}`,
			);

			setBlockedDomains(response.data);
			setBlockedDomainDrafts(
				Object.fromEntries(
					response.data.map((entry) => [
						entry.id,
						createDraftFromDomain(entry),
					]),
				),
			);
		} catch (error) {
			setBlockedListError(
				error instanceof Error
					? error.message
					: "Failed to load blocked signup domains",
			);
		} finally {
			setBlockedListLoading(false);
		}
	}

	async function createBlockedDomain() {
		setCreateBlockedStatus(null);
		setCreateBlockedLoading(true);

		try {
			await inboundRequest("admin/blocked-signup-domains", {
				method: "POST",
				body: JSON.stringify({
					domain: newDomain.trim(),
					reason: newReason.trim() || undefined,
					isActive: newActive === "true",
				}),
			});

			setNewDomain("");
			setNewReason("");
			setNewActive("true");
			setCreateBlockedStatus("Blocked domain created");
			await loadBlockedDomains();
		} catch (error) {
			setCreateBlockedStatus(
				error instanceof Error
					? error.message
					: "Failed to create blocked domain",
			);
		} finally {
			setCreateBlockedLoading(false);
		}
	}

	async function updateBlockedDomain(id: string) {
		const draft = blockedDomainDrafts[id];
		if (!draft) {
			return;
		}

		setSaveBlockedId(id);
		setBlockedListError(null);

		try {
			await inboundRequest(`admin/blocked-signup-domains/${id}`, {
				method: "PATCH",
				body: JSON.stringify({
					domain: draft.domain.trim(),
					reason: draft.reason.trim() ? draft.reason.trim() : null,
					isActive: draft.isActive,
				}),
			});

			await loadBlockedDomains();
		} catch (error) {
			setBlockedListError(
				error instanceof Error
					? error.message
					: "Failed to update blocked domain",
			);
		} finally {
			setSaveBlockedId(null);
		}
	}

	async function removeBlockedDomain(id: string) {
		setDeleteBlockedId(id);
		setBlockedListError(null);

		try {
			await inboundRequest(`admin/blocked-signup-domains/${id}`, {
				method: "DELETE",
			});

			await loadBlockedDomains();
		} catch (error) {
			setBlockedListError(
				error instanceof Error
					? error.message
					: "Failed to delete blocked domain",
			);
		} finally {
			setDeleteBlockedId(null);
		}
	}

	async function lookupBlockedDomainById() {
		setLookupBlockedError(null);
		setLookupBlockedResult(null);
		setLookupBlockedLoading(true);

		try {
			const result = await inboundRequest(
				`admin/blocked-signup-domains/${lookupBlockedId.trim()}`,
			);
			setLookupBlockedResult(result);
		} catch (error) {
			setLookupBlockedError(
				error instanceof Error
					? error.message
					: "Failed to lookup blocked domain",
			);
		} finally {
			setLookupBlockedLoading(false);
		}
	}

	async function pauseTenant() {
		setPauseError(null);
		setPauseResult(null);
		setPauseLoading(true);

		try {
			const result = await inboundRequest(
				`admin/tenants/${pauseTenantId.trim()}/pause`,
				{
					method: "POST",
					body: JSON.stringify({
						reason: pauseReason.trim() || undefined,
					}),
				},
			);
			setPauseResult(result);
		} catch (error) {
			setPauseError(
				error instanceof Error ? error.message : "Failed to pause tenant",
			);
		} finally {
			setPauseLoading(false);
		}
	}

	async function deleteIdentity() {
		setDeleteIdentityError(null);
		setDeleteIdentityResult(null);
		setDeleteIdentityLoading(true);

		try {
			const result = await inboundRequest(
				`admin/tenants/${identityTenantId.trim()}/identities/delete`,
				{
					method: "POST",
					body: JSON.stringify({
						identity: identityValue.trim(),
					}),
				},
			);
			setDeleteIdentityResult(result);
		} catch (error) {
			setDeleteIdentityError(
				error instanceof Error
					? error.message
					: "Failed to delete tenant identity",
			);
		} finally {
			setDeleteIdentityLoading(false);
		}
	}

	return (
		<div className="min-h-screen bg-muted/30">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
				<Card>
					<CardHeader>
						<CardTitle>Admin Manage</CardTitle>
						<CardDescription>
							Save your Inbound API key locally and manage admin trust and
							safety operations.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<FieldGroup>
							<div className="grid gap-4 md:grid-cols-2">
								<Field>
									<FieldLabel htmlFor="inbound-api-key">
										Inbound API Key
									</FieldLabel>
									<Input
										id="inbound-api-key"
										type="password"
										value={apiKey}
										onChange={(event) => setApiKey(event.target.value)}
										placeholder="inb_..."
									/>
								</Field>
								<Field>
									<FieldLabel htmlFor="inbound-base-url">
										API Base URL
									</FieldLabel>
									<Input
										id="inbound-base-url"
										value={baseUrl}
										onChange={(event) => setBaseUrl(event.target.value)}
										placeholder={DEFAULT_BASE_URL}
									/>
									<FieldDescription>
										Use a URL ending in <code>/api/e2</code>.
									</FieldDescription>
								</Field>
							</div>

							<div className="flex flex-wrap items-center gap-2">
								<Button onClick={saveCredentials}>
									<SaveIcon data-icon="inline-start" />
									Save Credentials
								</Button>
								<Button variant="outline" onClick={clearCredentials}>
									Clear
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										void loadBlockedDomains();
									}}
									disabled={!hasCredentials || blockedListLoading}
								>
									{blockedListLoading ? (
										<Loader2Icon
											data-icon="inline-start"
											className="animate-spin"
										/>
									) : (
										<RefreshCcwIcon data-icon="inline-start" />
									)}
									Refresh Domains
								</Button>
								<Badge variant={hasCredentials ? "secondary" : "outline"}>
									{hasCredentials ? "Credentials ready" : "Missing credentials"}
								</Badge>
							</div>

							{credentialStatus ? (
								<p className="text-muted-foreground text-xs/relaxed">
									{credentialStatus}
								</p>
							) : null}
						</FieldGroup>
					</CardContent>
				</Card>

				<TenantInsightsPanel
					hasCredentials={hasCredentials}
					inboundRequest={inboundRequest}
					onUsePauseTenant={(tenantId) => {
						setPauseTenantId(tenantId);
					}}
					onUseIdentity={(tenantId, identity) => {
						setIdentityTenantId(tenantId);
						setIdentityValue(identity);
					}}
				/>

				<div className="grid gap-6 xl:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Blocked Signup Domain CRUD</CardTitle>
							<CardDescription>
								Create and inspect blocked domain entries.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="create-domain">Domain</FieldLabel>
									<Input
										id="create-domain"
										value={newDomain}
										onChange={(event) => setNewDomain(event.target.value)}
										placeholder="example-spam-domain.com"
									/>
								</Field>

								<Field>
									<FieldLabel htmlFor="create-reason">Reason</FieldLabel>
									<Textarea
										id="create-reason"
										value={newReason}
										onChange={(event) => setNewReason(event.target.value)}
										placeholder="Optional reason"
										className="min-h-20"
									/>
								</Field>

								<Field>
									<FieldLabel>Active</FieldLabel>
									<Select value={newActive} onValueChange={setNewActive}>
										<SelectTrigger>
											<SelectValue placeholder="Select status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="true">Active</SelectItem>
											<SelectItem value="false">Inactive</SelectItem>
										</SelectContent>
									</Select>
								</Field>

								<Button
									onClick={() => {
										void createBlockedDomain();
									}}
									disabled={
										!hasCredentials ||
										createBlockedLoading ||
										newDomain.trim().length === 0
									}
								>
									{createBlockedLoading ? (
										<Loader2Icon
											data-icon="inline-start"
											className="animate-spin"
										/>
									) : null}
									Create Blocked Domain
								</Button>

								{createBlockedStatus ? (
									<p className="text-muted-foreground text-xs/relaxed">
										{createBlockedStatus}
									</p>
								) : null}

								<Field>
									<FieldLabel htmlFor="lookup-domain-id">
										Lookup by ID
									</FieldLabel>
									<div className="flex flex-col gap-2 sm:flex-row">
										<Input
											id="lookup-domain-id"
											value={lookupBlockedId}
											onChange={(event) =>
												setLookupBlockedId(event.target.value)
											}
											placeholder="bsd_xxx"
										/>
										<Button
											variant="outline"
											onClick={() => {
												void lookupBlockedDomainById();
											}}
											disabled={
												!hasCredentials ||
												lookupBlockedLoading ||
												lookupBlockedId.trim().length === 0
											}
										>
											{lookupBlockedLoading ? (
												<Loader2Icon
													data-icon="inline-start"
													className="animate-spin"
												/>
											) : (
												<SearchIcon data-icon="inline-start" />
											)}
											Get
										</Button>
									</div>
								</Field>

								{lookupBlockedError ? (
									<p className="text-destructive text-xs/relaxed">
										{lookupBlockedError}
									</p>
								) : null}

								{lookupBlockedResult ? (
									<pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-[11px] leading-relaxed">
										{JSON.stringify(lookupBlockedResult, null, 2)}
									</pre>
								) : null}
							</FieldGroup>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>AWS Tenant Actions</CardTitle>
							<CardDescription>
								Pause tenant sending and delete SES identities for a tenant.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<FieldGroup>
								<div className="grid gap-4 md:grid-cols-2">
									<Field>
										<FieldLabel htmlFor="pause-tenant-id">Tenant ID</FieldLabel>
										<Input
											id="pause-tenant-id"
											value={pauseTenantId}
											onChange={(event) => setPauseTenantId(event.target.value)}
											placeholder="tenant_xxx"
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor="pause-reason">Pause Reason</FieldLabel>
										<Input
											id="pause-reason"
											value={pauseReason}
											onChange={(event) => setPauseReason(event.target.value)}
											placeholder="Optional admin note"
										/>
									</Field>
								</div>

								<Button
									onClick={() => {
										void pauseTenant();
									}}
									disabled={
										!hasCredentials ||
										pauseLoading ||
										pauseTenantId.trim().length === 0
									}
								>
									{pauseLoading ? (
										<Loader2Icon
											data-icon="inline-start"
											className="animate-spin"
										/>
									) : (
										<PauseCircleIcon data-icon="inline-start" />
									)}
									Pause Tenant
								</Button>

								{pauseError ? (
									<p className="text-destructive text-xs/relaxed">
										{pauseError}
									</p>
								) : null}

								{pauseResult ? (
									<pre className="bg-muted max-h-60 overflow-auto rounded-md p-3 text-[11px] leading-relaxed">
										{JSON.stringify(pauseResult, null, 2)}
									</pre>
								) : null}

								<div className="bg-border/50 h-px" />

								<div className="grid gap-4 md:grid-cols-2">
									<Field>
										<FieldLabel htmlFor="identity-tenant-id">
											Tenant ID
										</FieldLabel>
										<Input
											id="identity-tenant-id"
											value={identityTenantId}
											onChange={(event) =>
												setIdentityTenantId(event.target.value)
											}
											placeholder="tenant_xxx"
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor="identity-value">
											SES Identity
										</FieldLabel>
										<Input
											id="identity-value"
											value={identityValue}
											onChange={(event) => setIdentityValue(event.target.value)}
											placeholder="example.com or user@example.com"
										/>
									</Field>
								</div>

								<Button
									variant="destructive"
									onClick={() => {
										void deleteIdentity();
									}}
									disabled={
										!hasCredentials ||
										deleteIdentityLoading ||
										identityTenantId.trim().length === 0 ||
										identityValue.trim().length === 0
									}
								>
									{deleteIdentityLoading ? (
										<Loader2Icon
											data-icon="inline-start"
											className="animate-spin"
										/>
									) : (
										<ShieldXIcon data-icon="inline-start" />
									)}
									Delete Identity
								</Button>

								{deleteIdentityError ? (
									<p className="text-destructive text-xs/relaxed">
										{deleteIdentityError}
									</p>
								) : null}

								{deleteIdentityResult ? (
									<pre className="bg-muted max-h-60 overflow-auto rounded-md p-3 text-[11px] leading-relaxed">
										{JSON.stringify(deleteIdentityResult, null, 2)}
									</pre>
								) : null}
							</FieldGroup>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<CardTitle>Blocked Signup Domains</CardTitle>
								<CardDescription>
									Update and delete existing block-list entries.
								</CardDescription>
							</div>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
								<Input
									value={blockedSearch}
									onChange={(event) => setBlockedSearch(event.target.value)}
									placeholder="Search domain"
								/>
								<Button
									variant="outline"
									onClick={() => {
										void loadBlockedDomains();
									}}
									disabled={!hasCredentials || blockedListLoading}
								>
									{blockedListLoading ? (
										<Loader2Icon
											data-icon="inline-start"
											className="animate-spin"
										/>
									) : (
										<RefreshCcwIcon data-icon="inline-start" />
									)}
									Refresh
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{blockedListError ? (
							<p className="text-destructive pb-3 text-xs/relaxed">
								{blockedListError}
							</p>
						) : null}

						{blockedDomains.length === 0 ? (
							<div className="text-muted-foreground rounded-md border border-dashed p-4 text-xs/relaxed">
								No blocked domains loaded yet.
							</div>
						) : (
							<div className="grid gap-3">
								{blockedDomains.map((entry) => {
									const draft =
										blockedDomainDrafts[entry.id] ??
										createDraftFromDomain(entry);

									return (
										<div
											key={entry.id}
											className="bg-card rounded-md border p-3"
										>
											<div className="mb-3 flex flex-wrap items-center gap-2">
												<Badge
													variant={entry.isActive ? "secondary" : "outline"}
												>
													{entry.isActive ? "Active" : "Inactive"}
												</Badge>
												<Badge variant="outline">ID: {entry.id}</Badge>
												<Badge variant="ghost">
													Created: {formatDate(entry.createdAt)}
												</Badge>
												<Badge variant="ghost">
													Updated: {formatDate(entry.updatedAt)}
												</Badge>
											</div>

											<div className="grid gap-3 lg:grid-cols-3">
												<Input
													value={draft.domain}
													onChange={(event) => {
														setBlockedDomainDrafts((current) => ({
															...current,
															[entry.id]: {
																...draft,
																domain: event.target.value,
															},
														}));
													}}
												/>
												<Textarea
													value={draft.reason}
													onChange={(event) => {
														setBlockedDomainDrafts((current) => ({
															...current,
															[entry.id]: {
																...draft,
																reason: event.target.value,
															},
														}));
													}}
													className="min-h-20"
												/>
												<Select
													value={draft.isActive ? "true" : "false"}
													onValueChange={(value) => {
														setBlockedDomainDrafts((current) => ({
															...current,
															[entry.id]: {
																...draft,
																isActive: value === "true",
															},
														}));
													}}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="true">Active</SelectItem>
														<SelectItem value="false">Inactive</SelectItem>
													</SelectContent>
												</Select>
											</div>

											<div className="mt-3 flex flex-wrap gap-2">
												<Button
													onClick={() => {
														void updateBlockedDomain(entry.id);
													}}
													disabled={
														!hasCredentials || saveBlockedId === entry.id
													}
												>
													{saveBlockedId === entry.id ? (
														<Loader2Icon
															data-icon="inline-start"
															className="animate-spin"
														/>
													) : (
														<SaveIcon data-icon="inline-start" />
													)}
													Save
												</Button>
												<Button
													variant="destructive"
													onClick={() => {
														void removeBlockedDomain(entry.id);
													}}
													disabled={
														!hasCredentials || deleteBlockedId === entry.id
													}
												>
													{deleteBlockedId === entry.id ? (
														<Loader2Icon
															data-icon="inline-start"
															className="animate-spin"
														/>
													) : (
														<Trash2Icon data-icon="inline-start" />
													)}
													Delete
												</Button>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

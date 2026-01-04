"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { useQueryStates, parseAsString } from "nuqs";
import {
	useApiKeysQuery,
	useCreateApiKeyMutation,
	useUpdateApiKeyMutation,
	useDeleteApiKeyMutation,
	useRevokeAllApiKeysMutation,
} from "@/features/settings/hooks";
import { CreateApiKeyForm } from "@/features/settings/types";
import Key2 from "@/components/icons/key-2";
import CircleCheck from "@/components/icons/circle-check";
import CirclePlus from "@/components/icons/circle-plus";
import Clipboard2 from "@/components/icons/clipboard-2";
import Trash2 from "@/components/icons/trash-2";
import Refresh2 from "@/components/icons/refresh-2";
import Magnifier2 from "@/components/icons/magnifier-2";
import Filter2 from "@/components/icons/filter-2";
import CircleXmark from "@/components/icons/circle-xmark";
import { ApiIdLabel } from "@/components/api-id-label";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import SidebarToggleButton from "@/components/sidebar-toggle-button";

export default function ApiKeysPage() {
	// Search and filter state with URL persistence
	const [filters, setFilters] = useQueryStates(
		{
			search: parseAsString.withDefault(""),
			status: parseAsString.withDefault("all"),
		},
		{ history: "push" },
	);

	const searchQuery = filters.search;
	const statusFilter = filters.status;

	const setSearchQuery = (value: string) =>
		setFilters({ search: value || null });
	const setStatusFilter = (value: string) =>
		setFilters({ status: value === "all" ? null : value });

	// Debounce inputs to reduce re-renders
	const debouncedSearch = useDebouncedValue(searchQuery, 300);
	const debouncedStatus = useDebouncedValue(statusFilter, 150);

	// React Query hooks
	const {
		data: apiKeysData = [],
		isLoading: isLoadingApiKeys,
		error: apiKeysError,
		refetch: refetchApiKeys,
	} = useApiKeysQuery();

	// Sort API keys by creation date (newest first)
	const apiKeys = [...apiKeysData].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	// Mutations
	const createApiKeyMutation = useCreateApiKeyMutation();
	const updateApiKeyMutation = useUpdateApiKeyMutation();
	const deleteApiKeyMutation = useDeleteApiKeyMutation();
	const revokeAllApiKeysMutation = useRevokeAllApiKeysMutation();

	// API Key state
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [newApiKey, setNewApiKey] = useState<string | null>(null);
	const [showNewApiKey, setShowNewApiKey] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
	const [revokeAllConfirmOpen, setRevokeAllConfirmOpen] = useState(false);
	const [createForm, setCreateForm] = useState<CreateApiKeyForm>({
		name: "",
		prefix: "",
	});

	const handleCreateApiKey = async () => {
		try {
			const createData = {
				name: createForm.name || undefined,
				prefix: createForm.prefix || undefined,
			};

			const result = await createApiKeyMutation.mutateAsync(createData);

			if (result?.key) {
				setNewApiKey(result.key);
				setShowNewApiKey(true);
				toast.success("API key created successfully");

				// Reset form
				setCreateForm({
					name: "",
					prefix: "",
				});
			}
		} catch (error) {
			console.error("Error creating API key:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to create API key",
			);
		}
	};

	const handleDeleteApiKey = async (keyId: string) => {
		try {
			await deleteApiKeyMutation.mutateAsync(keyId);
			toast.success("API key deleted successfully");
		} catch (error) {
			console.error("Error deleting API key:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to delete API key",
			);
		}
	};

	const handleUpdateApiKey = async (
		keyId: string,
		updates: { name?: string; enabled?: boolean },
	) => {
		try {
			// Ensure boolean values are properly handled
			const cleanUpdates = {
				...updates,
				enabled:
					updates.enabled !== undefined ? Boolean(updates.enabled) : undefined,
			};
			await updateApiKeyMutation.mutateAsync({ keyId, ...cleanUpdates });
			toast.success("API key updated successfully");
		} catch (error) {
			console.error("Error updating API key:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to update API key",
			);
		}
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success("Copied to clipboard");
		} catch (error) {
			toast.error("Failed to copy to clipboard");
		}
	};

	const handleRevokeAllApiKeys = async () => {
		try {
			const result = await revokeAllApiKeysMutation.mutateAsync();
			if (result.count === 0) {
				toast.info("No active API keys to revoke");
			} else {
				toast.success(
					`Successfully revoked ${result.count} API key${result.count === 1 ? "" : "s"}`,
				);
			}
			setRevokeAllConfirmOpen(false);
		} catch (error) {
			console.error("Error revoking all API keys:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to revoke API keys",
			);
		}
	};

	// Count active API keys
	const activeApiKeysCount = apiKeys.filter((key) =>
		Boolean(key.enabled),
	).length;

	// Filter API keys based on search query and status
	const q = debouncedSearch.trim().toLowerCase();
	const statusMatch = (apiKey: (typeof apiKeys)[number]) =>
		debouncedStatus === "all"
			? true
			: debouncedStatus === "active"
				? Boolean(apiKey.enabled)
				: debouncedStatus === "disabled"
					? !Boolean(apiKey.enabled)
					: true;

	const filteredApiKeys = apiKeys.filter((apiKey) => {
		// Build the key preview pattern for matching pasted API keys
		// Format: "prefix_start" if prefix exists, otherwise just "start"
		const keyPreview = apiKey.prefix
			? `${apiKey.prefix}_${apiKey.start || ""}`.toLowerCase()
			: (apiKey.start || "").toLowerCase();

		const textMatch =
			!q ||
			(apiKey.name || "").toLowerCase().includes(q) ||
			apiKey.id.toLowerCase().includes(q) ||
			(apiKey.prefix || "").toLowerCase().includes(q) ||
			(apiKey.start || "").toLowerCase().includes(q) ||
			// Allow matching when user pastes a full API key - check if the pasted key starts with our key preview
			(keyPreview && q.startsWith(keyPreview));
		return textMatch && statusMatch(apiKey);
	});

	// Helper functions
	const getApiKeyStatusDot = (apiKey: (typeof apiKeys)[number]) => {
		const isExpired =
			apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
		return (
			<div
				className={`w-2 h-2 rounded-full ${
					isExpired
						? "bg-red-500"
						: Boolean(apiKey.enabled)
							? "bg-green-500"
							: "bg-gray-500"
				}`}
			/>
		);
	};

	const getApiKeyStatusText = (apiKey: (typeof apiKeys)[number]) => {
		const isExpired =
			apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
		if (isExpired) return "Expired";
		return Boolean(apiKey.enabled) ? "Active" : "Disabled";
	};

	return (
		<>
			<div className="min-h-screen p-4">
				<div className="max-w-5xl mx-auto px-2">
					{/* Header */}
					<div className="mb-6">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<SidebarToggleButton />
								<div>
									<h2 className="text-2xl font-semibold text-foreground mb-1 tracking-tight">
										API Keys
									</h2>
									<p className="text-muted-foreground text-sm font-medium">
										{apiKeys.length} API keys
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button
									size="default"
									onClick={() => setIsCreateDialogOpen(true)}
								>
									<CirclePlus width="12" height="12" className="mr-1" />
									Create API Key
								</Button>
								<Button
									variant="outline"
									size="default"
									onClick={() => refetchApiKeys()}
									disabled={isLoadingApiKeys}
								>
									<Refresh2 width="14" height="14" className="mr-2" />
									Refresh
								</Button>
								{activeApiKeysCount > 0 && (
									<Button
										variant="destructive"
										size="default"
										onClick={() => setRevokeAllConfirmOpen(true)}
										disabled={revokeAllApiKeysMutation.isPending}
									>
										<CircleXmark width="14" height="14" className="mr-2" />
										Revoke All
									</Button>
								)}
							</div>
						</div>
					</div>

					{/* Filters */}
					<div className="">
						<div className="flex items-center gap-3 flex-wrap">
							<div className="relative flex-1 min-w-[200px]">
								<Magnifier2
									width="16"
									height="16"
									className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
								/>
								<Input
									placeholder="Search API keys..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-10 h-9 rounded-xl"
								/>
							</div>

							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger className="w-[140px] h-9 rounded-xl">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="disabled">Disabled</SelectItem>
								</SelectContent>
							</Select>

							{/* Clear button */}
						</div>
						{(searchQuery || statusFilter !== "all") && (
							<div className="mt-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setFilters({ search: null, status: null });
									}}
									className="h-8"
								>
									<Filter2 width="14" height="14" className="mr-2" />
									Clear filters
								</Button>
							</div>
						)}
					</div>
				</div>

				{/* API Keys List */}
				<div className="max-w-5xl mx-auto p-2">
					{isLoadingApiKeys ? (
						<div className="flex items-center justify-center py-20">
							<div className="text-muted-foreground">Loading API keys...</div>
						</div>
					) : !filteredApiKeys.length ? (
						<div className="max-w-6xl mx-auto p-4">
							<div className="bg-card border-border rounded-xl p-8">
								<div className="text-center">
									<Key2
										width="48"
										height="48"
										className="text-muted-foreground mx-auto mb-4"
									/>
									<h3 className="text-lg font-semibold mb-2 text-foreground">
										No API keys found
									</h3>
									<p className="text-sm text-muted-foreground mb-4">
										{searchQuery || statusFilter !== "all"
											? "Try adjusting your filters or search query."
											: "Create your first API key to start using the Inbound API."}
									</p>
									<Button
										variant="secondary"
										onClick={() => setIsCreateDialogOpen(true)}
									>
										<CirclePlus width="16" height="16" className="mr-2" />
										Create Your First API Key
									</Button>
								</div>
							</div>
						</div>
					) : (
						<div className="border border-border rounded-[13px] bg-card">
							{filteredApiKeys.map((apiKey) => {
								const isExpired = Boolean(
									apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date(),
								);

								return (
									<div
										key={apiKey.id}
										className="flex items-center gap-4 px-5 py-4 transition-colors cursor-default hover:bg-muted/50"
									>
										{/* API Key Icon with Status */}
										<div className="flex-shrink-0">
											<div className="relative p-[8px] rounded-md bg-muted">
												<Key2
													width="23"
													height="23"
													className="text-[#735ACF]"
												/>
												<div className="absolute -top-1 -right-1">
													{getApiKeyStatusDot(apiKey)}
												</div>
											</div>
										</div>

										{/* API Key Details */}
										<div className="flex-shrink-0 w-100 flex flex-col gap-[2px]">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium">
													{apiKey.name || "Unnamed API Key"}
												</span>
												<Badge
													variant={
														isExpired
															? "destructive"
															: Boolean(apiKey.enabled)
																? "default"
																: "secondary"
													}
												>
													{getApiKeyStatusText(apiKey)}
												</Badge>
											</div>

											<ApiIdLabel id={apiKey.id} size="sm" />

											<div className="flex items-center gap-2">
												<span className="text-xs opacity-60">
													Key: {apiKey.prefix || ""}***{apiKey.start}
												</span>
												{apiKey.remaining !== null && (
													<>
														<span className="text-xs opacity-60">·</span>
														<span className="text-xs opacity-60">
															{apiKey.remaining.toLocaleString()} remaining
														</span>
													</>
												)}
											</div>

											<div className="flex items-center gap-2">
												<span className="text-xs opacity-60">
													Created{" "}
													{format(new Date(apiKey.createdAt), "MMM d, yyyy")}
												</span>
											</div>
										</div>

										{/* Usage Stats */}
										<div className="flex-1 flex flex-col gap-1">
											{apiKey.expiresAt && (
												<div
													className={`text-xs ${isExpired ? "text-red-500" : "text-muted-foreground"}`}
												>
													{isExpired ? "Expired" : "Expires"}{" "}
													{formatDistanceToNow(new Date(apiKey.expiresAt), {
														addSuffix: true,
													})}
												</div>
											)}
											{apiKey.lastRequest && (
												<div className="text-xs text-muted-foreground">
													Last used{" "}
													{formatDistanceToNow(new Date(apiKey.lastRequest), {
														addSuffix: true,
													})}
												</div>
											)}
										</div>

										{/* Actions */}
										<div className="flex items-center gap-2 ml-4">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => {
													const currentEnabled = Boolean(apiKey.enabled);
													handleUpdateApiKey(apiKey.id, {
														enabled: !currentEnabled,
													});
												}}
												disabled={updateApiKeyMutation.isPending || isExpired}
												className="text-xs"
											>
												{updateApiKeyMutation.isPending
													? "Updating..."
													: Boolean(apiKey.enabled)
														? "Disable"
														: "Enable"}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="text-red-600 hover:text-red-700 h-9 w-9 p-0"
												onClick={() => {
													setKeyToDelete(apiKey.id);
													setDeleteConfirmOpen(true);
												}}
												title="Delete"
											>
												<Trash2 width="16" height="16" />
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>

			{/* Create API Key Dialog */}
			<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Create New API Key</DialogTitle>
						<DialogDescription>
							Create a new API key for programmatic access to your account.
						</DialogDescription>
					</DialogHeader>
					<div
						className="space-y-4"
						onKeyDown={(e) => {
							if (e.key === "Enter" && !createApiKeyMutation.isPending) {
								e.preventDefault();
								handleCreateApiKey();
							}
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="name">Name (optional)</Label>
							<Input
								id="name"
								placeholder="My API Key"
								value={createForm.name}
								onChange={(e) =>
									setCreateForm((prev) => ({ ...prev, name: e.target.value }))
								}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="prefix">Prefix (optional)</Label>
							<Input
								id="prefix"
								placeholder="myapp"
								value={createForm.prefix}
								onChange={(e) => {
									const value = e.target.value.replace(/\s+/g, "-");
									setCreateForm((prev) => ({ ...prev, prefix: value }));
								}}
							/>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								variant="secondary"
								onClick={() => setIsCreateDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={handleCreateApiKey}
								disabled={createApiKeyMutation.isPending}
							>
								{createApiKeyMutation.isPending
									? "Creating..."
									: "Create API Key"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete API Key</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this API key? This action cannot
							be undone and will immediately revoke access for any applications
							using this key.
						</DialogDescription>
					</DialogHeader>
					<div className="flex justify-end gap-2 mt-4">
						<Button
							variant="secondary"
							onClick={() => {
								setDeleteConfirmOpen(false);
								setKeyToDelete(null);
							}}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								if (keyToDelete) {
									handleDeleteApiKey(keyToDelete);
									setDeleteConfirmOpen(false);
									setKeyToDelete(null);
								}
							}}
						>
							Delete
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* New API Key Display Dialog */}
			<Dialog open={showNewApiKey} onOpenChange={setShowNewApiKey}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CircleCheck width="20" height="20" className="text-green-600" />
							API Key Created
						</DialogTitle>
						<DialogDescription>
							Your new API key has been created. Make sure to copy it now as you
							won't be able to see it again.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>API Key</Label>
							<div className="flex items-center gap-2">
								<Input
									value={newApiKey || ""}
									readOnly
									className="font-mono text-sm"
								/>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => copyToClipboard(newApiKey || "")}
								>
									<Clipboard2 width="16" height="16" />
								</Button>
							</div>
						</div>
						<div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
							<div className="flex items-start gap-2">
								<div className="w-4 h-4 rounded-full bg-amber-500 mt-0.5 flex-shrink-0"></div>
								<div className="text-sm text-amber-800 dark:text-amber-200">
									<strong>Important:</strong> This is the only time you'll see
									this API key. Make sure to copy and store it securely.
								</div>
							</div>
						</div>
						<Button
							onClick={() => {
								setShowNewApiKey(false);
								setNewApiKey(null);
								setIsCreateDialogOpen(false);
							}}
							className="w-full"
						>
							I've Saved My API Key
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Revoke All Confirmation Dialog */}
			<Dialog
				open={revokeAllConfirmOpen}
				onOpenChange={setRevokeAllConfirmOpen}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Revoke All API Keys</DialogTitle>
						<DialogDescription>
							Are you sure you want to revoke all {activeApiKeysCount} active
							API key{activeApiKeysCount === 1 ? "" : "s"}? This will
							immediately disable access for any applications using these keys.
							This action can be undone by re-enabling individual keys.
						</DialogDescription>
					</DialogHeader>
					<div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mt-2">
						<div className="flex items-start gap-2">
							<div className="w-4 h-4 rounded-full bg-red-500 mt-0.5 flex-shrink-0"></div>
							<div className="text-sm text-red-800 dark:text-red-200">
								<strong>Warning:</strong> All API integrations using these keys
								will stop working immediately.
							</div>
						</div>
					</div>
					<div className="flex justify-end gap-2 mt-4">
						<Button
							variant="secondary"
							onClick={() => setRevokeAllConfirmOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleRevokeAllApiKeys}
							disabled={revokeAllApiKeysMutation.isPending}
						>
							{revokeAllApiKeysMutation.isPending
								? "Revoking..."
								: `Revoke All ${activeApiKeysCount} Key${activeApiKeysCount === 1 ? "" : "s"}`}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

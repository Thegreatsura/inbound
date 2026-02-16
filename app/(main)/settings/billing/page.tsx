"use client";

import { useCustomer } from "autumn-js/react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PricingTable } from "@/components/pricing-table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	useBillingPortalMutation,
	useCustomerQuery,
} from "@/features/settings/hooks";
import { useSession } from "@/lib/auth/auth-client";
import { trackEvent } from "@/lib/utils/visitors";

export default function BillingPage() {
	const { data: session, isPending } = useSession();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { attach } = useCustomer();

	const [isUpgradingPlan, setIsUpgradingPlan] = useState<string | null>(null);
	const [isUpgradeSuccessOpen, setIsUpgradeSuccessOpen] = useState(false);

	const {
		data: customerData,
		isLoading: isLoadingCustomer,
		refetch: refetchCustomer,
	} = useCustomerQuery();

	const billingPortalMutation = useBillingPortalMutation();

	const handleManageBilling = async () => {
		try {
			const url = await billingPortalMutation.mutateAsync();
			window.open(url, "_blank");
		} catch (error) {
			console.error("Error creating billing portal session:", error);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to open billing portal",
			);
		}
	};

	const handlePlanUpgrade = async (plan: {
		name: string;
		autumn_id: string;
		price: number;
	}) => {
		setIsUpgradingPlan(plan.autumn_id);
		try {
			const result = (await attach({
				productId: plan.autumn_id,
				successUrl: `${window.location.origin}/settings/billing?upgrade=true&product=${plan.autumn_id}`,
			})) as any;

			if (result?.checkoutUrl) {
				window.location.href = result.checkoutUrl;
				return;
			}
			if (result?.data?.checkoutUrl) {
				window.location.href = result.data.checkoutUrl;
				return;
			}

			trackEvent("Purchase", { productId: plan.autumn_id });
			toast.success(`Successfully upgraded to ${plan.name} plan!`);
			refetchCustomer();
		} catch (error) {
			console.error("Plan upgrade error:", error);
			toast.error("Failed to process plan upgrade. Please try again.");
		} finally {
			setIsUpgradingPlan(null);
		}
	};

	// Check for upgrade success parameter
	useEffect(() => {
		const upgradeParam = searchParams.get("upgrade");
		const productParam = searchParams.get("product");

		if (upgradeParam === "true") {
			setIsUpgradeSuccessOpen(true);

			trackEvent("Purchase", {
				productId: productParam || "pro",
			});

			const newUrl = new URL(window.location.href);
			newUrl.searchParams.delete("upgrade");
			newUrl.searchParams.delete("product");
			router.replace(newUrl.pathname + newUrl.search);
		}
	}, [searchParams, router, session?.user?.email]);

	if (isPending) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-muted-foreground">Loading…</div>
			</div>
		);
	}

	if (!session) {
		router.push("/login");
		return null;
	}

	const activeProduct = customerData?.products?.find(
		(p) => p.status === "active" || p.status === "trialing",
	);

	return (
		<div className="min-h-screen p-4">
			<div className="max-w-3xl mx-auto">
				{/* Header */}
				<header className="mb-8 pt-2">
					<h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
					<p className="text-muted-foreground text-sm mt-1">
						Manage your subscription and billing.
					</p>
				</header>

				{/* Current Plan */}
				<section className="mb-8 p-6 border rounded-lg bg-card">
					<div className="flex items-start justify-between">
						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
								Current plan
							</p>
							{isLoadingCustomer ? (
								<div className="h-7 w-24 bg-muted rounded animate-pulse" />
							) : (
								<div className="flex items-center gap-3">
									<h2 className="text-2xl font-semibold capitalize">
										{activeProduct?.name || "Starter"}
									</h2>
									<span
										className={`text-xs px-2 py-0.5 rounded-full ${
											activeProduct?.status === "active"
												? "bg-green-100 text-green-800"
												: activeProduct?.status === "trialing"
													? "bg-yellow-100 text-yellow-800"
													: "bg-muted text-muted-foreground"
										}`}
									>
										{activeProduct?.status === "active"
											? "Active"
											: activeProduct?.status === "trialing"
												? "Trial"
												: "Inactive"}
									</span>
								</div>
							)}
						</div>
						<button
							onClick={handleManageBilling}
							disabled={billingPortalMutation.isPending}
							className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
						>
							{billingPortalMutation.isPending ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<ExternalLink className="w-4 h-4" />
							)}
							Manage billing
						</button>
					</div>
				</section>

				{/* Upgrade Options */}
				<section>
					<h2 className="text-lg font-semibold mb-4">Choose a plan</h2>
					<PricingTable
						showHeader={false}
						onPlanSelect={handlePlanUpgrade}
						isLoading={isUpgradingPlan}
						currentPlan={activeProduct?.id || "starter"}
					/>
				</section>
			</div>

			{/* Upgrade Success Dialog */}
			<Dialog
				open={isUpgradeSuccessOpen}
				onOpenChange={setIsUpgradeSuccessOpen}
			>
				<DialogContent className="max-w-md">
					<div className="text-center py-4">
						<div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
							<Check className="w-6 h-6 text-green-600" />
						</div>
						<DialogTitle className="text-xl mb-2">
							Upgrade successful!
						</DialogTitle>
						<DialogDescription className="text-muted-foreground">
							Your new plan is now active. Thank you for upgrading!
						</DialogDescription>
						<button
							onClick={() => {
								setIsUpgradeSuccessOpen(false);
								refetchCustomer();
							}}
							className="mt-6 w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg transition-colors font-medium"
						>
							Continue
						</button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

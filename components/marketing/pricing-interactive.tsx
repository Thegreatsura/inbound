"use client";

import { useCustomer } from "autumn-js/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAutumnCustomer } from "@/app/actions/primary";
import { PricingTable, plans } from "@/components/pricing-table";
import { useSession } from "@/lib/auth/auth-client";

export function PricingInteractive() {
	const { data: session } = useSession();
	const { attach } = useCustomer();
	const router = useRouter();
	const [isLoading, setIsLoading] = useState<string | null>(null);
	const [currentPlan, setCurrentPlan] = useState<string | null>(null);

	const handlePlanSelection = async (plan: (typeof plans)[0]) => {
		if (!session?.user) {
			router.push("/login");
			return;
		}

		if (plan.autumn_id === "free") {
			router.push("/logs");
			return;
		}

		setIsLoading(plan.autumn_id);

		try {
			const result = (await attach({
				productId: plan.autumn_id,
				successUrl: `${window.location.origin}/logs?upgrade=true&product=${plan.autumn_id}`,
			})) as Record<string, unknown>;

			if (result?.checkoutUrl) {
				window.location.href = result.checkoutUrl as string;
				return;
			}
			if (
				result?.data &&
				typeof result.data === "object" &&
				(result.data as Record<string, unknown>)?.checkoutUrl
			) {
				window.location.href = (result.data as Record<string, unknown>)
					.checkoutUrl as string;
				return;
			}

			toast.success(`Successfully upgraded to ${plan.name} plan!`);
			router.push("/logs");
		} catch (error) {
			console.error("Plan selection error:", error);
			toast.error("Failed to process plan change. Please try again.");
			setIsLoading(null);
		}
	};

	useEffect(() => {
		const fetchCustomer = async () => {
			if (!session?.user) {
				setCurrentPlan(null);
				return;
			}

			try {
				const response = await getAutumnCustomer();
				if (response.customer) {
					const mainProduct = response.customer.products?.find(
						(product) => product.status === "active" && !product.is_add_on,
					);
					setCurrentPlan(mainProduct ? mainProduct.id : "free");
				} else {
					setCurrentPlan("free");
				}
			} catch (error) {
				console.error("Error fetching customer data:", error);
				setCurrentPlan("free");
			}
		};

		fetchCustomer();
	}, [session?.user]);

	return (
		<PricingTable
			showHeader={false}
			onPlanSelect={handlePlanSelection}
			isLoading={isLoading}
			currentPlan={currentPlan}
		/>
	);
}

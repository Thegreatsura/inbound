"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/auth-client";
import { queryClient } from "@/lib/query-client";
import { identifyUser, trackEvent } from "@/lib/utils/visitors";

interface QueryProviderProps {
	children: React.ReactNode;
}

function SessionTracker() {
	const { data: session } = useSession();

	useEffect(() => {
		if (!session?.user) return;

		identifyUser({
			id: session.user.id,
			email: session.user.email || undefined,
			name: session.user.name || undefined,
		});

		const key = `visitors_login_tracked_${session.session.id}`;
		if (!sessionStorage.getItem(key)) {
			trackEvent("Login");
			sessionStorage.setItem(key, "1");
		}
	}, [session?.user, session?.session?.id]);

	return null;
}

export function QueryProvider({ children }: QueryProviderProps) {
	return (
		<QueryClientProvider client={queryClient}>
			<SessionTracker />
			{children}
			{/* Only show devtools in development */}
			{process.env.NODE_ENV === "development" && (
				<ReactQueryDevtools initialIsOpen={false} />
			)}
		</QueryClientProvider>
	);
}

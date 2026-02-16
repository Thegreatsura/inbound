declare global {
	interface Window {
		visitors?: {
			track: (
				event: string,
				properties?: Record<string, string | number | boolean | null>,
			) => void;
			identify: (user: {
				id: string;
				email?: string;
				name?: string;
				[key: string]: string | number | boolean | undefined;
			}) => void;
		};
	}
}

export function trackEvent(
	event: string,
	properties?: Record<string, string | number | boolean | null>,
) {
	if (typeof window !== "undefined" && window.visitors) {
		window.visitors.track(event, properties);
	}
}

export function identifyUser(user: {
	id: string;
	email?: string;
	name?: string;
	[key: string]: string | number | boolean | undefined;
}) {
	if (typeof window !== "undefined" && window.visitors) {
		window.visitors.identify(user);
	}
}

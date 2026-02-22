export type HomepageContent = {
	_title: string;
	heroPrimaryText: string;
	heroSublineText: string;
	ctaButtonPrimaryText: string;
};

const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
	_title: "inbound",
	heroPrimaryText: "Programmable email infrastructure.",
	heroSublineText:
		"Send, receive, and reply to email with one API designed for developers.",
	ctaButtonPrimaryText: "Get Started",
};

export async function getHomepageContent() {
	return {
		success: true,
		data: DEFAULT_HOMEPAGE_CONTENT,
	};
}

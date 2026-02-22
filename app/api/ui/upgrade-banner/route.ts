import { NextResponse } from "next/server";

const defaultBanner = {
	shown: false,
	shownToPlans: ["pro", "scale", "growth"],
	title: "Upgrade to Pro",
	body: "Unlock higher limits, advanced routing, and priority support.",
	linkText: "View pricing",
	link: "/pricing",
};

export async function GET() {
	return NextResponse.json({
		success: true,
		banner: defaultBanner,
	});
}

import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
	title: "Inbound Admin Manage",
	description: "Admin dashboard for Inbound trust and safety operations",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={roboto.variable}>
			<body className="antialiased">{children}</body>
		</html>
	);
}

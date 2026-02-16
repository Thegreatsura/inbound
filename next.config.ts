import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	// Add Turbopack configuration to suppress warnings
	turbopack: {
		// Empty configuration to acknowledge Turbopack usage
	},

	// Performance optimizations for SEO and Core Web Vitals
	experimental: {
		optimizePackageImports: ["inboundemail", "lucide-react", "framer-motion"],
		scrollRestoration: true,
	},

	// Image optimization for better performance
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "inbound.new",
			},
			{
				protocol: "https",
				hostname: "assets.basehub.com",
			},
		],
		formats: ["image/webp", "image/avif"],
		minimumCacheTTL: 86400, // 1 day cache for better performance
		dangerouslyAllowSVG: true,
		contentDispositionType: "attachment",
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
	},

	// Compression for better performance
	compress: true,

	// Generate ETags for better caching
	generateEtags: true,

	// Power monitoring for performance insights
	poweredByHeader: false,
	async headers() {
		return [
			{
				// API routes: CORS headers + security headers
				source: "/api/:path*",
				headers: [
					{
						key: "Access-Control-Allow-Origin",
						value:
							process.env.NODE_ENV === "development"
								? "https://dev.inbound.new"
								: process.env.VERCEL_URL
									? `https://${process.env.VERCEL_URL}`
									: "https://inbound.new",
					},
					{
						key: "Access-Control-Allow-Methods",
						value: "GET, POST, PUT, DELETE, OPTIONS",
					},
					{
						key: "Access-Control-Allow-Headers",
						value: "Content-Type, Authorization",
					},
					{
						key: "Access-Control-Allow-Credentials",
						value: "true",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
				],
			},
			{
				// All other routes: security headers (no CORS needed)
				source: "/:path*",
				headers: [
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
					},
				],
			},
		];
	},
	async rewrites() {
		return [
			// Reroute all v2 API requests to e2
			{
				source: "/api/v2/:path*",
				destination: "/api/e2/:path*",
			},
		];
	},
	async redirects() {
		return [
			// Disable v1 API - return 410 Gone
			{
				source: "/api/v1/:path*",
				destination: "/api/deprecated",
				permanent: true,
			},
			// Disable v1.1 API - return 410 Gone
			{
				source: "/api/v1.1/:path*",
				destination: "/api/deprecated",
				permanent: true,
			},
		];
	},
};

export default nextConfig;

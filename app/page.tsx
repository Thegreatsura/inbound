import { BookOpen } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import DatabaseCloud from "@/components/icons/database-cloud";
import EnvelopeSparkle from "@/components/icons/envelope-sparkle";
import { CodeTabs } from "@/components/marketing/code-tabs";
import { DemoInbox } from "@/components/marketing/demo-inbox";
import { HeroSignupButton } from "@/components/marketing/hero-signup-button";
import { MarketingFooter, MarketingNav } from "@/components/marketing-nav";
import { PricingTable } from "@/components/pricing-table";
import { auth } from "@/lib/auth/auth";

export default async function Page() {
	const session = await auth.api
		.getSession({
			headers: await headers(),
		})
		.catch(() => null);

	const isLoggedIn = !!session?.user;

	return (
		<div className="min-h-screen bg-[#fafaf9] text-[#1c1917] selection:bg-[#8161FF] selection:text-white">
			{/* Top announcement banner */}
			<div className="bg-[#8161FF] text-white text-center py-2 px-4">
				<p className="text-sm">
					<span className="font-medium">Extra domains now just $3.50/mo</span>
					<span className="opacity-80 ml-1.5">— add as many as you need</span>
				</p>
			</div>

			<div className="max-w-2xl mx-auto px-6">
				<MarketingNav isLoggedIn={isLoggedIn} />

				{/* Hero */}
				<section className="pt-20 pb-16">
					<h1 className="font-heading text-[32px] leading-[1.2] tracking-tight max-w-2xl">
						<span className="text-[##1B1917]">Programmable</span>{" "}
						<span className="text-[#8161FF]">email</span>{" "}
						<span className="whitespace-nowrap text-[#8161FF]">
							<DatabaseCloud className="w-8 h-8 inline-block align-middle" />{" "}
							infrastructure.
						</span>{" "}
						<span className="text-[##1B1917]">
							Send, receive, reply, and thread
						</span>{" "}
						<span className="text-[#8161FF]">within</span>{" "}
						<span className="whitespace-nowrap text-[#8161FF]">
							<EnvelopeSparkle className="w-8 h-8 inline-block align-middle" />{" "}
							mailboxes.
						</span>
					</h1>

					{!isLoggedIn && <HeroSignupButton />}

					{/* Email Generator - Client Component */}
					<DemoInbox />
				</section>

				{/* Code Block - Light Monaco-style theme */}
				<section className="py-12 border-t border-[#e7e5e4]">
					<div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
						<span className="text-[#16a34a] font-mono text-sm font-medium">
							$
						</span>
						<code className="font-mono text-sm text-[#1c1917]">
							bun install inboundemail
						</code>
					</div>
					<CodeTabs />
					<p className="mt-4 text-sm text-[#52525b] flex items-center gap-4">
						<Link
							href="/docs"
							className="text-[#1c1917] hover:underline flex items-center gap-1.5"
						>
							<BookOpen className="w-4 h-4" />
							Read the docs
						</Link>
						<span className="text-[#a8a29e]">or</span>
						<a
							href="https://github.com/inbound-org"
							target="_blank"
							rel="noopener noreferrer"
							className="text-[#1c1917] hover:underline flex items-center gap-1.5"
						>
							<svg className="w-4 h-4" viewBox="0 0 24 24" fill="#000337">
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
							</svg>
							view on GitHub
						</a>
					</p>
				</section>

				<section className="py-10 border-t border-[#e7e5e4]">
					<p className="text-xs text-[#78716c] uppercase tracking-wide mb-6">
						Trusted by
					</p>
					<div className="flex items-center gap-10">
						<img
							src="/images/agentuity.png"
							alt="Agentuity"
							className="h-5 object-contain opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all"
						/>
						<img
							src="/images/mandarin-3d.png"
							alt="Mandarin 3D"
							className="h-5 object-contain opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all"
						/>
						<img
							src="/images/teslanav.png"
							alt="TeslaNav"
							className="h-5 object-contain opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all"
						/>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="133"
							height="16"
							viewBox="0 0 266 32"
							fill="none"
							className="opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all"
						>
							<path
								fill="currentColor"
								d="M39.127 12.622H24.606V0h-4.692v13.695c0 1.454.574 2.851 1.595 3.88l11.857 11.958 3.317-3.346-8.757-8.831h11.203v-4.732l-.002-.002ZM2.446 5.812l8.758 8.832H0v4.731h14.521v12.622h4.692V18.302a5.514 5.514 0 0 0-1.595-3.88L5.764 2.466 2.446 5.812Zm58.84 19.78c-2.132 0-3.883-.466-5.245-1.397-1.365-.931-2.189-2.262-2.475-3.993l3.827-.998c.153.777.414 1.386.776 1.829.362.445.814.759 1.352.95a5.33 5.33 0 0 0 1.765.282c.967 0 1.682-.172 2.143-.514.462-.345.695-.77.695-1.282s-.22-.903-.661-1.18c-.442-.278-1.143-.505-2.113-.682l-.923-.168a16.437 16.437 0 0 1-3.133-.915c-.947-.389-1.704-.927-2.276-1.614-.571-.687-.857-1.574-.857-2.66 0-1.642.594-2.9 1.78-3.777 1.19-.875 2.748-1.315 4.685-1.315 1.824 0 3.342.412 4.551 1.23 1.21.82 2 1.896 2.375 3.226l-3.86 1.197c-.176-.841-.533-1.441-1.071-1.796-.538-.355-1.204-.533-1.995-.533-.791 0-1.398.14-1.814.417-.419.278-.628.661-.628 1.148 0 .532.22.926.66 1.18.44.255 1.034.45 1.782.582l.923.167c1.233.222 2.347.515 3.348.883 1 .365 1.79.888 2.375 1.564.581.677.875 1.593.875 2.746 0 1.728-.623 3.066-1.865 4.008-1.243.944-2.909 1.415-4.998 1.415h.002Zm14.099-.067c-1.276 0-2.39-.294-3.347-.883-.957-.586-1.7-1.402-2.228-2.444-.528-1.042-.79-2.241-.79-3.592V8.76h4.155v9.514c0 1.243.302 2.174.909 2.794.604.62 1.467.932 2.59.932 1.275 0 2.265-.427 2.969-1.281.704-.855 1.056-2.046 1.056-3.577V8.76h4.156v16.5h-4.09v-2.162h-.594c-.263.556-.758 1.1-1.485 1.632-.724.532-1.827.797-3.299.797l-.002-.002Zm12.439 6.387V8.76h4.09v1.996h.594c.373-.643.957-1.214 1.748-1.713.79-.5 1.924-.749 3.398-.749a7.14 7.14 0 0 1 3.661.98c1.123.654 2.023 1.614 2.705 2.877.681 1.263 1.023 2.794 1.023 4.59v.532c0 1.796-.342 3.327-1.023 4.59-.682 1.264-1.585 2.224-2.705 2.877a7.146 7.146 0 0 1-3.66.98c-.99 0-1.82-.116-2.49-.35-.672-.231-1.21-.532-1.618-.898a5.397 5.397 0 0 1-.972-1.114h-.595v8.55h-4.156v.005Zm8.578-9.846c1.298 0 2.37-.417 3.217-1.248s1.27-2.046 1.27-3.643v-.332c0-1.598-.428-2.813-1.286-3.643-.857-.832-1.923-1.248-3.199-1.248-1.276 0-2.342.416-3.199 1.248-.857.83-1.286 2.045-1.286 3.643v.332c0 1.597.429 2.812 1.286 3.643.857.831 1.921 1.248 3.197 1.248Zm13.263 3.526c-1.277 0-2.394-.294-3.348-.883-.957-.586-1.7-1.402-2.228-2.444-.528-1.042-.792-2.241-.792-3.592V8.76h4.156v9.514c0 1.243.304 2.174.908 2.794.604.62 1.467.932 2.59.932 1.275 0 2.265-.427 2.969-1.281.704-.855 1.056-2.046 1.056-3.577V8.76h4.156v16.5h-4.09v-2.162h-.594c-.264.556-.76 1.1-1.486 1.632-.725.532-1.827.797-3.299.797h.002Zm12.439.067V8.76h4.09v2.162h.595c.263-.576.752-1.125 1.468-1.647.714-.523 1.818-.782 3.315-.782 1.277 0 2.39.294 3.348.883.957.588 1.698 1.4 2.227 2.444.528 1.042.792 2.241.792 3.592v9.846h-4.156v-9.514c0-1.242-.302-2.174-.909-2.794-.604-.62-1.467-.932-2.59-.932-1.275 0-2.264.427-2.969 1.281-.704.855-1.055 2.046-1.055 3.577v8.382h-4.156l.002.002h-.002Zm22.55.067c-1.848 0-3.41-.427-4.684-1.28-1.277-.856-2.113-2.082-2.508-3.677l3.86-1.198c.176.776.535 1.382 1.072 1.813.539.433 1.265.648 2.178.648.858 0 1.5-.153 1.931-.466.427-.31.643-.706.643-1.18 0-.477-.22-.857-.66-1.148-.441-.29-1.124-.523-2.047-.7l-1.056-.199a11.22 11.22 0 0 1-2.903-.916 5.287 5.287 0 0 1-2.046-1.614c-.528-.687-.79-1.547-.79-2.578 0-1.553.571-2.8 1.715-3.744 1.143-.941 2.664-1.414 4.567-1.414 1.584 0 2.947.35 4.089 1.047 1.143.699 1.912 1.673 2.31 2.927l-3.86 1.198c-.154-.576-.446-1.042-.875-1.397-.433-.355-1.01-.532-1.73-.532-.703 0-1.26.145-1.664.434-.407.289-.612.659-.612 1.113 0 .488.22.87.66 1.148.44.278 1.11.503 2.013.682l1.056.2c1.276.242 2.38.565 3.315.964.935.4 1.66.936 2.178 1.614.517.676.776 1.552.776 2.627 0 1.664-.609 2.963-1.831 3.894-1.219.931-2.824 1.397-4.816 1.397l.002-.002Zm11.12-.067v-5.23h-2.507V8.76h6.663v12.533l5.607-12.533h4.386L192.3 20.03h2.572v5.23h-6.663V12.728l-5.608 12.533h-4.386l4.02-12.533h-2.572v12.533h-4.155l-.002-.002Zm22.42.067c-1.782 0-3.353-.408-4.716-1.23-1.364-.82-2.434-1.995-3.316-3.526-.879-1.531-1.319-3.36-1.319-5.49 0-2.13.44-3.96 1.319-5.49.882-1.531 2.065-2.708 3.547-3.527 1.485-.82 3.143-1.23 4.979-1.23 1.759 0 3.316.389 4.666 1.164 1.353.776 2.408 1.862 3.166 3.261.759 1.397 1.14 3.048 1.14 4.955v1.63h-14.659c.066 1.73.493 3.048 1.286 3.96.79.91 1.875 1.364 3.249 1.364 1.033 0 1.882-.253 2.541-.764.66-.51 1.126-1.175 1.4-1.996l3.86 1.264c-.615 1.575-1.594 2.822-2.936 3.743-1.342.92-2.979 1.38-4.914 1.38l.002.002h-.296l.002-.268Zm-5.146-13.431h10.306c-.112-1.508-.549-2.658-1.319-3.443-.77-.788-1.787-1.182-3.051-1.182-1.341 0-2.427.42-3.25 1.264-.824.844-1.362 1.969-1.616 3.377l-.07-.016Zm21.792 13.431c-2.023 0-3.708-.511-5.047-1.53-1.341-1.02-2.145-2.441-2.408-4.257l3.86-1.098c.176 1.065.571 1.863 1.187 2.394.617.533 1.418.798 2.408.798.901 0 1.584-.175 2.046-.533.462-.355.693-.826.693-1.414 0-.554-.231-.998-.693-1.331-.462-.332-1.176-.59-2.145-.764l-1.055-.2c-1.607-.308-2.93-.826-3.96-1.563-1.033-.734-1.549-1.813-1.549-3.227 0-1.685.612-2.994 1.832-3.927 1.22-.931 2.798-1.397 4.731-1.397 1.804 0 3.316.437 4.534 1.314 1.22.875 2.003 2.09 2.343 3.643l-3.86 1.098c-.174-.844-.521-1.475-1.038-1.896-.517-.42-1.204-.632-2.063-.632-.769 0-1.373.162-1.814.484-.44.322-.661.741-.661 1.264 0 .555.231.993.694 1.315.462.32 1.156.571 2.078.748l1.055.199c1.672.31 3.026.842 4.056 1.597 1.033.753 1.549 1.876 1.549 3.36 0 1.752-.627 3.113-1.882 4.076-1.252.964-2.89 1.448-4.913 1.448l.002-.002v-.172Zm-124.5 0c-2.024 0-3.71-.511-5.047-1.53-1.342-1.02-2.145-2.441-2.409-4.257l3.86-1.098c.176 1.065.571 1.863 1.188 2.394.616.533 1.418.798 2.407.798.902 0 1.585-.175 2.047-.533.462-.355.693-.826.693-1.414 0-.554-.231-.998-.693-1.331-.462-.332-1.177-.59-2.145-.764l-1.056-.2c-1.606-.308-2.93-.826-3.959-1.563-1.033-.734-1.55-1.813-1.55-3.227 0-1.685.612-2.994 1.832-3.927 1.221-.931 2.798-1.397 4.732-1.397 1.804 0 3.315.437 4.534 1.314 1.22.875 2.002 2.09 2.342 3.643l-3.86 1.098c-.174-.844-.52-1.475-1.038-1.896-.517-.42-1.204-.632-2.063-.632-.769 0-1.373.162-1.813.484-.44.322-.661.741-.661 1.264 0 .555.231.993.693 1.315.462.32 1.157.571 2.079.748l1.055.199c1.672.31 3.027.842 4.056 1.597 1.033.753 1.55 1.876 1.55 3.36 0 1.752-.628 3.113-1.882 4.076-1.253.964-2.891 1.448-4.914 1.448l.002-.002v-.172Z"
							/>
						</svg>
					</div>

					<div className="mt-8 bg-[#fafaf9] rounded-lg">
						<div className="flex items-start gap-3">
							<div className="flex-shrink-0 w-10 h-10 bg-[#18181b] rounded-lg flex items-center justify-center">
								<img
									src="/images/linkdr.svg"
									alt="LinkDR"
									className="h-5 w-5"
								/>
							</div>
							<div>
								<a
									href="https://linkdr.com"
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-[#18181b] hover:underline"
								>
									LinkDR
								</a>
								<p className="text-sm text-[#52525b] leading-relaxed">
									LinkDR uses Inbound to power their internal order management
									system for backlink management, processing thousands of
									automated emails daily.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* What it does */}
				<section className="py-12 border-t border-[#e7e5e4]">
					<h2 className="font-heading text-xl font-semibold tracking-tight mb-6">
						What is Inbound?
					</h2>
					<div className="space-y-4 text-[#3f3f46] leading-relaxed">
						<p>
							Inbound lets you send and receive emails programmatically. Add
							your domain, configure your MX records, and you're ready to go.
							Unlimited mailboxes on that domain, no setup required for each
							address.
						</p>
						<p>
							Send from any address on your domain. Receive at any address.
							Route specific addresses to dedicated endpoints, or set up a
							catch-all that forwards everything to a single webhook. Perfect
							for support domains that route all incoming mail to an AI agent.
						</p>
						<p>
							Every email preserves threading automatically. Reply
							programmatically and we handle all the headers so your responses
							show up in the right thread. It just works.
						</p>
					</div>

					<div className="mt-8 space-y-2">
						<p className="text-xs text-[#78716c] uppercase tracking-wide mb-3">
							Example routes
						</p>
						<div className="font-mono text-sm space-y-1.5">
							<div className="flex items-center gap-3">
								<span className="text-[#52525b]">support@acme.com</span>
								<span className="text-[#a8a29e]">&rarr;</span>
								<span className="text-[#3f3f46]">/api/support-agent</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-[#52525b]">billing@acme.com</span>
								<span className="text-[#a8a29e]">&rarr;</span>
								<span className="text-[#3f3f46]">/api/billing</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-[#52525b]">*@acme.com</span>
								<span className="text-[#a8a29e]">&rarr;</span>
								<span className="text-[#3f3f46]">/api/catch-all</span>
							</div>
						</div>
					</div>
				</section>

				<PricingTable />

				{/* FAQ */}
				<section className="py-12 border-t border-[#e7e5e4]">
					<h2 className="font-heading text-xl font-semibold tracking-tight mb-6">
						FAQ
					</h2>
					<div className="space-y-6">
						<div>
							<p className="text-[#1c1917]">Can I use my own domain?</p>
							<p className="text-sm text-[#52525b] mt-1">
								Yes. Configure your MX records to point to our servers and you
								can receive email at any address on your domain.
							</p>
						</div>
						<div>
							<p className="text-[#1c1917]">How fast are webhooks delivered?</p>
							<p className="text-sm text-[#52525b] mt-1">
								Typically under 100ms from when we receive the email. We retry
								failed webhooks with exponential backoff.
							</p>
						</div>
						<div>
							<p className="text-[#1c1917]">What about spam filtering?</p>
							<p className="text-sm text-[#52525b] mt-1">
								We run incoming email through spam detection. You can choose to
								reject, flag, or accept spam in your mailbox settings.
							</p>
						</div>
					</div>
				</section>

				<MarketingFooter />
			</div>
		</div>
	);
}

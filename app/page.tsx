"use client";

import { useState, useEffect, useMemo } from "react";
import { Copy, Check, RefreshCw, BookOpen, X } from "lucide-react";
import { sonare } from "sonare";
import Link from "next/link";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { PricingTable } from "@/components/pricing-table";
import EnvelopeSparkle from "@/components/icons/envelope-sparkle";
import DatabaseCloud from "@/components/icons/database-cloud";
import { useRealtime } from "@/lib/realtime-client";

interface InboxEmail {
	from: string;
	subject: string;
	preview: string;
	timestamp: Date;
	emailId?: string;
}

const INBOX_STORAGE_KEY = "inbound-demo-inbox";

const Page = () => {
	const [email, setEmail] = useState("");
	const [copied, setCopied] = useState(false);
	const [emails, setEmails] = useState<InboxEmail[]>([]);
	const [activeTab, setActiveTab] = useState<"send" | "receive" | "mailboxes">(
		"send",
	);

	// Extract the local part (word) from the email for channel subscription
	const inboxId = useMemo(() => {
		if (!email) return null;
		return email.split("@")[0];
	}, [email]);

	// Channel name for this inbox
	const channel = useMemo(() => {
		return inboxId ? `inbox-${inboxId}` : null;
	}, [inboxId]);

	// Subscribe to realtime events for this inbox
	// The hook manages the SSE connection and dispatches events
	useRealtime({
		channels: channel ? [channel] : [],
		events: ["inbox.emailReceived"],
		onData({ data }) {
			const emailData = data as {
				from: string;
				subject: string;
				preview: string;
				timestamp: string;
				emailId?: string;
			};
			const newEmail: InboxEmail = {
				from: emailData.from,
				subject: emailData.subject,
				preview: emailData.preview,
				timestamp: new Date(emailData.timestamp),
				emailId: emailData.emailId,
			};
			setEmails((prev) => [newEmail, ...prev]);
		},
	});

	// Generate a new inbox email and persist to localStorage
	const generateEmail = (forceNew = false) => {
		// Check localStorage for existing inbox (unless forcing new)
		if (!forceNew && typeof window !== "undefined") {
			const stored = localStorage.getItem(INBOX_STORAGE_KEY);
			if (stored) {
				setEmail(stored);
				return;
			}
		}

		// Generate new inbox
		const word = sonare({ minLength: 6, maxLength: 10 });
		const newEmail = `${word}@inbox.inbound.new`;
		setEmail(newEmail);
		setCopied(false);
		setEmails([]);

		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem(INBOX_STORAGE_KEY, newEmail);
		}
	};

	// Initialize email on mount - restore from localStorage or generate new
	useEffect(() => {
		generateEmail(false);
	}, []);

	const copyToClipboard = async () => {
		await navigator.clipboard.writeText(email);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const dismissEmail = (index: number) => {
		setEmails((prev) => prev.filter((_, i) => i !== index));
	};

	const codeExamples = {
		send: {
			comment: "// Send an email",
			code: `import inbound from 'inboundemail'
      
const { data, error } = await inbound.email.send({
  from: 'Inbound <hello@inbound.new>',
  to: ['your@email.com'],
  subject: 'Welcome to Inbound!',
  html: '<p>Thanks for signing up.</p>'
})`,
		},
		receive: {
			comment: "// Receive emails via webhook",
			code: `export async function POST(req) {
  const { from, subject, body } = await req.json() as InboundWebhook

  // Process the email
  await handleEmail({ from, subject, body })

  // Reply to the thread
  await inbound.reply(from, 'Got it, thanks!')
}`,
		},
		mailboxes: {
			comment: "// List messages in a mailbox",
			code: `const { data } = await inbound.mail.list({
  limit: 10
})

data.emails.forEach(email => {
  console.log(email.subject)
  console.log(\`\${email.preview}\`)
})`,
		},
	};

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
				<MarketingNav />

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

					{/* Email Generator */}
					<div className="mt-12">
						<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
							<div className="flex-1 bg-white border border-[#e7e5e4] rounded-lg px-3 py-2 flex items-center gap-3 min-w-0">
								<span className="font-mono text-sm text-[#3f3f46] truncate">
									{email}
								</span>
								<button
									onClick={copyToClipboard}
									className="ml-auto text-[#52525b] hover:text-[#1c1917] transition-colors flex-shrink-0"
								>
									{copied ? (
										<Check className="w-4 h-4 text-[#8161FF]" />
									) : (
										<Copy className="w-4 h-4" />
									)}
								</button>
							</div>
						</div>
						<p className="mt-3 text-sm text-[#52525b]">
							This is a real inbox. Send an email to this address and watch it
							appear in real-time.
						</p>

						{emails.length > 0 && (
							<div className="mt-4 space-y-2">
								{emails.map((mail, i) => (
									<div
										key={i}
										className="bg-white border border-[#e7e5e4] rounded-xl p-4 animate-in slide-in-from-top-2 fade-in duration-300 relative group"
									>
										<button
											onClick={() => dismissEmail(i)}
											className="absolute top-3 right-3 text-[#a8a29e] hover:text-[#1c1917] transition-colors opacity-0 group-hover:opacity-100"
										>
											<X className="w-4 h-4" />
										</button>
										<div className="flex items-center gap-2 mb-1">
											<span className="text-sm font-medium text-[#1c1917]">
												{mail.from}
											</span>
											<span className="text-xs text-[#a8a29e]">just now</span>
										</div>
										<p className="text-sm text-[#3f3f46]">{mail.subject}</p>
										<p className="text-xs text-[#78716c] mt-1 line-clamp-1">
											{mail.preview}
										</p>
									</div>
								))}
							</div>
						)}
					</div>
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
					<div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl overflow-hidden">
						{/* Tab bar with macOS dots */}
						<div className="flex items-center justify-between px-4 border-b border-[#e5e5e5] bg-[#f0f0f0] py-2">
							<div className="flex items-center gap-1.5">
								<div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
								<div className="w-3 h-3 rounded-full bg-[#febc2e]" />
								<div className="w-3 h-3 rounded-full bg-[#28c840]" />
							</div>
							<div className="flex items-center gap-1 text-xs font-mono">
								<button
									onClick={() => setActiveTab("send")}
									className={`px-3 py-1 rounded-md transition-colors ${
										activeTab === "send"
											? "bg-white text-[#1c1917] shadow-sm"
											: "text-[#52525b] hover:text-[#1c1917]"
									}`}
								>
									send
								</button>
								<button
									onClick={() => setActiveTab("receive")}
									className={`px-3 py-1 rounded-md transition-colors ${
										activeTab === "receive"
											? "bg-white text-[#1c1917] shadow-sm"
											: "text-[#52525b] hover:text-[#1c1917]"
									}`}
								>
									receive
								</button>
								<button
									onClick={() => setActiveTab("mailboxes")}
									className={`px-3 py-1 rounded-md transition-colors ${
										activeTab === "mailboxes"
											? "bg-white text-[#1c1917] shadow-sm"
											: "text-[#52525b] hover:text-[#1c1917]"
									}`}
								>
									mailboxes
								</button>
							</div>
						</div>
						<pre className="p-5 font-mono text-[13px] leading-relaxed overflow-x-auto">
							<code>
								<span className="text-[#16a34a] italic">
									{codeExamples[activeTab].comment}
								</span>
								{"\n\n"}
								{codeExamples[activeTab].code.split("\n").map((line, i) => {
									// Simple syntax highlighting
									const highlightedLine = line
										.replace(
											/\b(const|await|async|function|export)\b/g,
											"<kw>$1</kw>",
										)
										.replace(/'([^']*)'/g, "<str>'$1'</str>")
										.replace(/`([^`]*)`/g, "<str>`$1`</str>")
										.replace(/\/\/.*/g, "<cmt>$&</cmt>")
										.replace(/\b(console)\b/g, "<obj>$1</obj>")
										.replace(
											/\.(send|email|reply|thread|list|log|json|forEach)\b/g,
											".<fn>$1</fn>",
										);

									return (
										<span key={i}>
											{highlightedLine
												.split(
													/(<kw>.*?<\/kw>|<str>.*?<\/str>|<cmt>.*?<\/cmt>|<obj>.*?<\/obj>|<fn>.*?<\/fn>)/,
												)
												.map((part, j) => {
													if (part.startsWith("<kw>"))
														return (
															<span
																key={j}
																className="text-[#7c3aed] font-medium"
															>
																{part.replace(/<\/?kw>/g, "")}
															</span>
														);
													if (part.startsWith("<str>"))
														return (
															<span key={j} className="text-[#c2410c]">
																{part.replace(/<\/?str>/g, "")}
															</span>
														);
													if (part.startsWith("<cmt>"))
														return (
															<span key={j} className="text-[#16a34a] italic">
																{part.replace(/<\/?cmt>/g, "")}
															</span>
														);
													if (part.startsWith("<obj>"))
														return (
															<span key={j} className="text-[#0891b2]">
																{part.replace(/<\/?obj>/g, "")}
															</span>
														);
													if (part.startsWith("<fn>"))
														return (
															<span key={j} className="text-[#0d9488]">
																{part.replace(/<\/?fn>/g, "")}
															</span>
														);
													return (
														<span key={j} className="text-[#374151]">
															{part}
														</span>
													);
												})}
											{i <
												codeExamples[activeTab].code.split("\n").length - 1 &&
												"\n"}
										</span>
									);
								})}
							</code>
						</pre>
					</div>
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
								d="M39.127 12.622H24.606V0h-4.692v13.695c0 1.454.574 2.851 1.595 3.88l11.857 11.958 3.317-3.346-8.757-8.831h11.203v-4.732l-.002-.002ZM2.446 5.812l8.758 8.832H0v4.731h14.521v12.622h4.692V18.302a5.514 5.514 0 0 0-1.595-3.88L5.764 2.466 2.446 5.812Zm58.84 19.78c-2.132 0-3.883-.466-5.245-1.397-1.365-.931-2.189-2.262-2.475-3.993l3.827-.998c.153.777.414 1.386.776 1.829.362.445.814.759 1.352.95a5.33 5.33 0 0 0 1.765.282c.967 0 1.682-.172 2.143-.514.462-.345.695-.77.695-1.282s-.22-.903-.661-1.18c-.442-.278-1.143-.505-2.113-.682l-.923-.168a16.437 16.437 0 0 1-3.133-.915c-.947-.389-1.704-.927-2.276-1.614-.571-.687-.857-1.574-.857-2.66 0-1.642.594-2.9 1.78-3.777 1.19-.875 2.748-1.315 4.685-1.315 1.824 0 3.342.412 4.551 1.23 1.21.82 2 1.896 2.375 3.226l-3.86 1.197c-.176-.841-.533-1.441-1.071-1.796-.538-.355-1.204-.533-1.995-.533-.791 0-1.398.14-1.814.417-.419.278-.628.661-.628 1.148 0 .532.22.926.66 1.18.44.255 1.034.45 1.782.582l.923.167c1.233.222 2.347.515 3.348.883 1 .365 1.79.888 2.375 1.564.581.677.875 1.593.875 2.746 0 1.728-.623 3.066-1.865 4.008-1.243.944-2.909 1.415-4.998 1.415h.002Zm14.099-.067c-1.276 0-2.39-.294-3.347-.883-.957-.586-1.7-1.402-2.228-2.444-.528-1.042-.79-2.241-.79-3.592V8.76h4.155v9.514c0 1.243.302 2.174.909 2.794.604.62 1.467.932 2.59.932 1.275 0 2.265-.427 2.969-1.281.704-.855 1.056-2.046 1.056-3.577V8.76h4.156v16.5h-4.09v-2.162h-.594c-.263.556-.758 1.1-1.485 1.632-.724.532-1.827.797-3.299.797l-.002-.002Zm12.439 6.387V8.76h4.09v1.996h.594c.373-.643.957-1.214 1.748-1.713.79-.5 1.924-.749 3.398-.749a7.14 7.14 0 0 1 3.661.98c1.123.654 2.023 1.614 2.705 2.877.681 1.263 1.023 2.794 1.023 4.59v.532c0 1.796-.342 3.327-1.023 4.59-.682 1.264-1.585 2.224-2.705 2.877a7.146 7.146 0 0 1-3.66.98c-.99 0-1.82-.116-2.49-.35-.672-.231-1.21-.532-1.618-.898a5.397 5.397 0 0 1-.972-1.114h-.595v8.55h-4.156v.005Zm8.578-9.846c1.298 0 2.37-.417 3.217-1.248s1.27-2.046 1.27-3.643v-.332c0-1.598-.428-2.813-1.286-3.643-.857-.832-1.923-1.248-3.199-1.248-1.276 0-2.342.416-3.2 1.248-.856.83-1.285 2.045-1.285 3.643v.332c0 1.597.428 2.812 1.286 3.643.857.83 1.923 1.248 3.199 1.248h-.002Zm18.277 3.66c-1.628 0-3.061-.35-4.304-1.047a7.361 7.361 0 0 1-2.903-2.961c-.692-1.276-1.038-2.779-1.038-4.508v-.399c0-1.729.339-3.231 1.023-4.508a7.258 7.258 0 0 1 2.87-2.96c1.232-.698 2.661-1.048 4.288-1.048 1.628 0 3.003.36 4.189 1.08 1.187.721 2.113 1.72 2.771 2.995.661 1.277.99 2.756.99 4.441v1.43h-11.909c.043 1.133.462 2.051 1.252 2.761.791.71 1.761 1.066 2.904 1.066s2.023-.255 2.571-.765a5.393 5.393 0 0 0 1.253-1.695l3.398 1.796c-.308.576-.752 1.204-1.336 1.88-.585.677-1.358 1.254-2.327 1.73-.967.476-2.199.715-3.694.715l.002-.003Zm-3.993-10.613h7.654c-.089-.954-.467-1.719-1.138-2.295-.671-.576-1.546-.864-2.622-.864-1.077 0-2.013.288-2.672.864-.66.576-1.066 1.343-1.219 2.295h-.003Zm13.919 10.147V8.76h4.09v1.863h.595c.242-.666.642-1.153 1.204-1.464.561-.311 1.214-.466 1.962-.466h1.979v3.726h-2.046c-1.056 0-1.923.283-2.604.849-.682.566-1.024 1.436-1.024 2.611v9.381h-4.156Zm11.415 0V8.76h4.089v1.795h.595c.285-.553.757-1.037 1.418-1.446.661-.409 1.528-.615 2.605-.615 1.166 0 2.1.227 2.804.682a4.56 4.56 0 0 1 1.617 1.78h.595a4.81 4.81 0 0 1 1.584-1.762c.681-.466 1.648-.697 2.903-.697 1.011 0 1.929.216 2.756.648.824.432 1.484 1.086 1.979 1.963.495.878.743 1.979.743 3.311v10.845h-4.156V14.718c0-.908-.232-1.59-.692-2.046-.461-.455-1.112-.681-1.946-.681-.947 0-1.676.306-2.194.916-.518.61-.776 1.48-.776 2.611v9.749h-4.156V14.72c0-.909-.232-1.59-.691-2.046-.462-.455-1.112-.682-1.947-.682-.946 0-1.676.306-2.194.916-.518.61-.775 1.48-.775 2.612v9.748h-4.156l-.005-.01Zm33.98.466c-1.628 0-3.062-.35-4.304-1.047a7.357 7.357 0 0 1-2.904-2.961c-.691-1.276-1.038-2.779-1.038-4.508v-.399c0-1.729.339-3.231 1.023-4.508a7.264 7.264 0 0 1 2.87-2.96c1.232-.698 2.661-1.048 4.289-1.048 1.628 0 3.003.36 4.189 1.08 1.186.721 2.112 1.72 2.771 2.995.66 1.277.989 2.756.989 4.441v1.43h-11.909c.044 1.133.462 2.051 1.253 2.761.791.71 1.76 1.066 2.903 1.066s2.023-.255 2.574-.765a5.393 5.393 0 0 0 1.253-1.695l3.398 1.796c-.308.576-.752 1.204-1.336 1.88-.585.677-1.358 1.254-2.327 1.73-.967.476-2.199.715-3.694.715v-.003Zm-3.991-10.613h7.654c-.089-.954-.467-1.719-1.138-2.295-.671-.576-1.546-.864-2.622-.864-1.077 0-2.013.288-2.672.864-.66.576-1.066 1.343-1.219 2.295h-.003Zm13.917 10.147V8.76h4.089v1.795h.595c.286-.553.758-1.037 1.418-1.446.661-.409 1.529-.615 2.605-.615 1.166 0 2.1.227 2.804.682a4.56 4.56 0 0 1 1.617 1.78h.595a4.816 4.816 0 0 1 1.584-1.762c.681-.466 1.648-.697 2.904-.697 1.01 0 1.928.216 2.755.648.824.432 1.485 1.086 1.98 1.963.495.878.742 1.979.742 3.311v10.845h-4.156V14.718c0-.908-.232-1.59-.691-2.046-.462-.455-1.113-.681-1.947-.681-.946 0-1.676.306-2.194.916-.518.61-.776 1.48-.776 2.611v9.749h-4.155V14.72c0-.909-.233-1.59-.692-2.046-.462-.455-1.112-.682-1.946-.682-.947 0-1.677.306-2.195.916-.517.61-.775 1.48-.775 2.612v9.748h-4.156l-.005-.01Zm34.306.466c-1.628 0-3.089-.332-4.388-.998a7.45 7.45 0 0 1-3.069-2.895c-.748-1.263-1.123-2.783-1.123-4.556v-.533c0-1.775.373-3.293 1.123-4.556a7.45 7.45 0 0 1 3.069-2.895c1.296-.666 2.76-.998 4.388-.998 1.628 0 3.09.332 4.388.998a7.486 7.486 0 0 1 3.069 2.895c.748 1.263 1.12 2.784 1.12 4.556v.533c0 1.775-.375 3.293-1.12 4.556a7.45 7.45 0 0 1-3.069 2.895c-1.298.666-2.76.998-4.388.998Zm0-3.725c1.276 0 2.329-.417 3.166-1.248.837-.831 1.253-2.025 1.253-3.576v-.332c0-1.552-.413-2.746-1.237-3.577-.825-.83-1.886-1.248-3.184-1.248-1.299 0-2.332.417-3.167 1.248-.836.831-1.252 2.025-1.252 3.577v.332c0 1.551.416 2.745 1.252 3.576.837.83 1.891 1.248 3.167 1.248h.002Zm10.756 3.259V8.76h4.09v1.863h.594c.243-.666.643-1.153 1.205-1.464.561-.311 1.214-.466 1.961-.466h1.98v3.726h-2.046c-1.056 0-1.924.283-2.605.849-.681.566-1.023 1.436-1.023 2.611v9.381h-4.156Zm13.195 6.653v-3.658h8.906c.615 0 .924-.332.924-.999V23.1h-.595c-.176.378-.451.753-.824 1.132-.375.378-.88.686-1.518.93-.637.245-1.451.366-2.441.366-1.276 0-2.393-.293-3.347-.882-.957-.587-1.699-1.402-2.228-2.444-.528-1.043-.79-2.242-.79-3.592V8.76h4.156v9.515c0 1.243.301 2.174.908 2.794.604.62 1.467.932 2.589.932 1.276 0 2.266-.427 2.97-1.281.704-.855 1.056-2.046 1.056-3.577V8.76h4.156v19.428c0 1.132-.329 2.035-.99 2.712-.661.676-1.541 1.013-2.638 1.013h-10.294Zm17.415-21.906h1.421v4.075h1.173v-4.075h1.421V8.908h-4.015v1.099Zm7.921-1.099-.801 4.07-.799-4.07h-1.939v5.174h1.146v-3.694l.73 3.694h1.727l.729-3.694v3.694h1.146V8.908h-1.939Z"
							/>
						</svg>
					</div>

					<div className="mt-8 p-6 bg-[#fafaf9] rounded-lg border border-[#e7e5e4]">
						<div className="flex items-start gap-4">
							<div className="flex-shrink-0 w-12 h-12 bg-[#18181b] rounded-lg flex items-center justify-center">
								<img
									src="/images/linkdr.svg"
									alt="LinkDR"
									className="h-6 w-6"
								/>
							</div>
							<div>
								<div className="flex items-center gap-2 mb-1">
									<span className="font-medium text-[#18181b]">LinkDR</span>
									<span className="text-xs text-[#78716c] bg-[#f5f5f4] px-2 py-0.5 rounded">
										Featured
									</span>
								</div>
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
								<span className="text-[#a8a29e]">→</span>
								<span className="text-[#3f3f46]">/api/support-agent</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-[#52525b]">billing@acme.com</span>
								<span className="text-[#a8a29e]">→</span>
								<span className="text-[#3f3f46]">/api/billing</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-[#52525b]">*@acme.com</span>
								<span className="text-[#a8a29e]">→</span>
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
};

export default Page;

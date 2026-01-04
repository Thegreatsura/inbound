"use client";

import { Button } from "@/components/ui/button";
import Check2 from "@/components/icons/check-2";
import Copy2 from "@/components/icons/copy-2";
import CirclePlay from "@/components/icons/circle-play";
import ArrowBoldRight from "@/components/icons/arrow-bold-right";
import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { useCreateApiKeyMutation } from "@/features/settings/hooks";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export default function OnboardingDemoPage() {
	const { data: session, isPending } = useSession();
	const router = useRouter();
	const createApiKeyMutation = useCreateApiKeyMutation();

	const [currentStep, setCurrentStep] = useState(1);
	const [isRunning, setIsRunning] = useState(false);
	const [apiKeyCreated, setApiKeyCreated] = useState(false);
	const [emailSent, setEmailSent] = useState(false);
	const [emailReceived, setEmailReceived] = useState(false);
	const [apiKeyCopied, setApiKeyCopied] = useState(false);
	const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);

	// Demo email functionality
	const [demoEmail, setDemoEmail] = useState("");
	const [demoOutput, setDemoOutput] = useState<string | null>(null);
	const [isListeningForReply, setIsListeningForReply] = useState(false);
	const [pollTimeLeft, setPollTimeLeft] = useState(0);
	const [showManualCheck, setShowManualCheck] = useState(false);
	const [isManualChecking, setIsManualChecking] = useState(false);
	const [pollEndTime, setPollEndTime] = useState<number | null>(null);
	const [replyReceived, setReplyReceived] = useState<{
		from: string;
		subject: string;
		body: string;
		receivedAt: string;
	} | null>(null);

	// Light-only mode enforced (easter egg disabled)
	const [theme, setTheme] = useState<"light" | "dark">("light");

	// Set default demo email when session loads
	useEffect(() => {
		if (session?.user?.email && !demoEmail) {
			setDemoEmail(session.user.email);
		}
	}, [session?.user?.email, demoEmail]);

	// Redirect if not authenticated
	useEffect(() => {
		if (!isPending && !session?.user) {
			router.push("/login");
		}
	}, [session, isPending, router]);

	// Check polling status on mount (in case user navigated back)
	useEffect(() => {
		if (pollEndTime) {
			updateCountdown();

			// If we're past the end time, show manual check
			if (!shouldStillPoll() && isListeningForReply) {
				console.log(
					"🔄 [MOUNT] Polling time elapsed while away - showing manual check",
				);
				setIsListeningForReply(false);
				setShowManualCheck(true);
				setPollEndTime(null);
			}
		}
	}, []); // Only run on mount

	// Timer effect to update countdown and check polling status
	useEffect(() => {
		if (!pollEndTime) return;

		const interval = setInterval(() => {
			updateCountdown();
		}, 1000);

		return () => clearInterval(interval);
	}, [pollEndTime, isListeningForReply]);

	// Initialize and enforce light-only
	useEffect(() => {
		try {
			localStorage.setItem("theme", "light");
			setTheme("light");
			const d = document.documentElement;
			d.classList.remove("dark");
		} catch {}
	}, []);

	// Theme toggle disabled
	const toggleTheme = () => {
		return;
	};

	const handleCreateApiKey = async () => {
		try {
			const result = await createApiKeyMutation.mutateAsync({
				name: "Demo API Key",
				prefix: "demo",
			});

			if (result?.key) {
				setCreatedApiKey(result.key);
				setApiKeyCreated(true);
				toast.success("API key created successfully!");
				setTimeout(() => {
					setCurrentStep(2);
				}, 800);
			}
		} catch (error) {
			toast.error("Failed to create API key");
			console.error("API key creation error:", error);
		}
	};

	if (isPending) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
			</div>
		);
	}

	if (!session?.user) {
		return null;
	}

	const handleCopyApiKey = async () => {
		try {
			const keyToCopy = createdApiKey || "demo-key-not-available";
			await navigator.clipboard.writeText(keyToCopy);
			setApiKeyCopied(true);
			toast.success("API key copied to clipboard!");
			setTimeout(() => setApiKeyCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy API key:", err);
			toast.error("Failed to copy API key");
		}
	};

	// Check if we should still be polling based on timestamp
	const shouldStillPoll = () => {
		if (!pollEndTime) return false;
		return Date.now() < pollEndTime;
	};

	// Update countdown timer based on timestamp
	const updateCountdown = () => {
		if (!pollEndTime) {
			setPollTimeLeft(0);
			return;
		}

		const timeLeft = Math.max(0, Math.ceil((pollEndTime - Date.now()) / 1000));
		setPollTimeLeft(timeLeft);

		if (timeLeft === 0 && isListeningForReply) {
			console.log(
				"⏰ [POLLING] 60 seconds elapsed - stopping automatic polling",
			);
			setIsListeningForReply(false);
			setShowManualCheck(true);
			setPollEndTime(null);
		}
	};

	const startListeningForReply = () => {
		console.log(
			"🎯 [ONBOARDING] Starting reply listener - will poll for 60 seconds",
		);
		console.log("🎯 [ONBOARDING] User email:", session?.user?.email);
		console.log("🎯 [ONBOARDING] Demo email sent to:", demoEmail);

		// Set end time 60 seconds in the future
		const endTime = Date.now() + 60 * 1000;
		setPollEndTime(endTime);
		setIsListeningForReply(true);
		setPollTimeLeft(60);
		setShowManualCheck(false);

		console.log(
			"🕐 [POLLING] Poll will end at:",
			new Date(endTime).toISOString(),
		);

		const checkForReply = async () => {
			const now = Date.now();
			const timeLeft = Math.max(0, Math.ceil((endTime - now) / 1000));

			console.log(
				"🔄 [POLLING] Checking for reply...",
				new Date().toISOString(),
			);
			console.log("🔄 [POLLING] Time left:", timeLeft, "seconds");
			console.log("🔄 [POLLING] Should still poll:", shouldStillPoll());

			try {
				const response = await fetch("/api/v2/onboarding/check-reply");
				console.log(
					"📡 [POLLING] Response status:",
					response.status,
					response.statusText,
				);

				if (response.ok) {
					const data = await response.json();
					console.log(
						"📋 [POLLING] Response data:",
						JSON.stringify(data, null, 2),
					);

					if (data.hasReply && data.reply) {
						console.log("🎉 [POLLING] Reply found! Details:", {
							from: data.reply.from,
							subject: data.reply.subject,
							bodyLength: data.reply.body?.length || 0,
							receivedAt: data.reply.receivedAt,
						});

						setReplyReceived(data.reply);
						setIsListeningForReply(false);
						setShowManualCheck(false);
						setPollEndTime(null);
						setPollTimeLeft(0);
						setEmailReceived(true);
						setCurrentStep(4);
						setDemoOutput(
							(prev) =>
								`${prev}\n\n🎉 Reply received!\nFrom: ${data.reply.from}\nSubject: ${data.reply.subject}\nIt looks like you like the ${data.reply.body} mail client!`,
						);
						console.log(
							"✅ [POLLING] Stopping polling - reply received and processed",
						);
						return;
					} else {
						console.log("📭 [POLLING] No reply yet, will continue polling...");
					}
				} else {
					console.error(
						"❌ [POLLING] API error:",
						response.status,
						response.statusText,
					);
				}
			} catch (error) {
				console.error("❌ [POLLING] Network error checking for reply:", error);
				console.error("❌ [POLLING] Error details:", {
					message: error instanceof Error ? error.message : "Unknown error",
					stack: error instanceof Error ? error.stack : undefined,
				});
			}

			// Continue polling if time hasn't elapsed
			if (now < endTime) {
				console.log("⏰ [POLLING] Scheduling next check in 3 seconds...");
				setTimeout(checkForReply, 3000); // Poll every 3 seconds
			} else {
				console.log("🛑 [POLLING] Stopping polling - time elapsed");
				setIsListeningForReply(false);
				setShowManualCheck(true);
				setPollEndTime(null);
			}
		};

		// Start the first check
		console.log("🚀 [POLLING] Starting first reply check...");
		checkForReply();
	};

	const handleManualCheck = async () => {
		console.log("🔍 [MANUAL] Manual check for reply triggered");
		setIsManualChecking(true);

		try {
			const response = await fetch("/api/v2/onboarding/check-reply");
			console.log(
				"📡 [MANUAL] Response status:",
				response.status,
				response.statusText,
			);

			if (response.ok) {
				const data = await response.json();
				console.log(
					"📋 [MANUAL] Response data:",
					JSON.stringify(data, null, 2),
				);

				if (data.hasReply && data.reply) {
					console.log("🎉 [MANUAL] Reply found!");
					setReplyReceived(data.reply);
					setShowManualCheck(false);
					setEmailReceived(true);
					setCurrentStep(4);
					setDemoOutput(
						(prev) =>
							`${prev}\n\n🎉 Reply received!\nFrom: ${data.reply.from}\nSubject: ${data.reply.subject}`,
					);
				} else {
					console.log("📭 [MANUAL] No reply found yet");
					setDemoOutput(
						(prev) =>
							`${prev}\n\n📭 No reply yet - check again after replying to the email`,
					);
				}
			} else {
				console.error(
					"❌ [MANUAL] API error:",
					response.status,
					response.statusText,
				);
			}
		} catch (error) {
			console.error("❌ [MANUAL] Error checking for reply:", error);
		} finally {
			setIsManualChecking(false);
		}
	};

	const handleRunCode = async () => {
		if (!createdApiKey || !demoEmail) return;

		setIsRunning(true);
		setDemoOutput("Running demo...");
		setCurrentStep(3);

		try {
			const response = await fetch("/api/v2/onboarding/demo", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					apiKey: createdApiKey,
					to: demoEmail,
				}),
			});

			const result = await response.json();

			if (response.ok) {
				console.log("✅ [DEMO] Email sent successfully:", {
					emailId: result.id,
					sentTo: demoEmail,
					userEmail: session?.user?.email,
				});

				setEmailSent(true);
				setDemoOutput(
					`✅ Success!\nEmail sent to ${demoEmail} with ID: ${result.id}, check your inbox!\n\n🎯 Waiting for your reply...\n\n$ inbound.emails.awaitReply( ${demoEmail} )`,
				);
				setIsListeningForReply(true);

				console.log("🎯 [DEMO] Starting reply polling system...");
				startListeningForReply();
			} else {
				console.error("❌ [DEMO] Failed to send email:", result);
				setDemoOutput(`❌ Error: ${result.error || "Unknown error"}`);
			}
		} catch (error) {
			setDemoOutput(
				`❌ Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			setIsRunning(false);
		}
	};

	return (
		<div className="min-h-screen bg-background">
			<div className="flex">
				{/* Main Content */}
				<div className="flex-1">
					{/* Main Header */}
					<div className="max-w-4xl mx-auto px-20 py-12 pb-16">
						<h1 className="text-4xl font-semibold text-foreground mb-4 tracking-[-0.02em]">
							Let's send (and receive!) your first{" "}
							<span
								className="cursor-pointer hover:text-primary transition-colors duration-200 hover:scale-105 inline-block transform"
								onClick={toggleTheme}
								title="Click me! 🎨"
							>
								email
							</span>
							.
						</h1>
						<p className="text-base text-muted-foreground font-medium tracking-[-0.02em]">
							We will walk you through sending and receiving emails with
							inbound's SDK. Get typesafe webhooks with full email data for
							maximum observability.
						</p>

						<div className="mt-6 flex items-center gap-3">
							<Button
								variant="outline"
								onClick={() => router.push("/logs")}
								className="text-muted-foreground hover:text-foreground border-border hover:border-foreground/20"
							>
								Skip to Dashboard
							</Button>
							<Button
								variant="ghost"
								asChild
								className="text-primary hover:text-primary/80"
							>
								<a
									href="https://youtu.be/MOi19cSQdRI"
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-2"
								>
									<CirclePlay width={16} height={16} />
									Watch Video Tutorial
								</a>
							</Button>
						</div>
					</div>

					<div className="border-t border-dashed border-border"></div>

					{/* Step 1: Create API Key */}
					<div
						className={`max-w-4xl mx-auto px-20 py-16 transition-opacity duration-300 ${
							currentStep < 1 ? "opacity-40" : ""
						}`}
					>
						<div className="flex items-center gap-3 mb-4">
							<h2 className="text-xl font-semibold text-foreground tracking-[-0.02em]">
								Create an inbound API key
							</h2>
							{apiKeyCreated ? (
								<div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200 dark:border-emerald-800">
									<span>Created</span>
									<Check2 className="w-3 h-3" />
								</div>
							) : (
								<div className="flex items-center gap-2 text-muted-foreground px-3 py-1 rounded-full text-xs font-medium">
									<span>Not created</span>
									<div className="w-3 h-3 border-2 border-border rounded-full border-dashed" />
								</div>
							)}
						</div>

						<p className="text-sm text-muted-foreground font-medium tracking-[-0.02em] mb-6">
							This will enable you to send and receive emails through inbound's
							API with full webhook support.
						</p>

						{!apiKeyCreated ? (
							<Button
								onClick={handleCreateApiKey}
								className="bg-primary hover:bg-primary/90 px-6 py-3 rounded-lg font-medium text-sm"
								disabled={currentStep !== 1 || createApiKeyMutation.isPending}
							>
								{createApiKeyMutation.isPending
									? "Creating..."
									: "Create API Key"}
							</Button>
						) : (
							<div className="animate-in slide-in-from-top-2 duration-500">
								<div className="rounded-lg p-4 px-[0] py-[0] border-0">
									<div className="flex items-center justify-between mb-2">
										<span className="text-xs text-muted-foreground font-medium tracking-[-0.02em]">
											API Key
										</span>
									</div>
									<div className="flex items-center gap-3">
										<code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded border flex-1 break-all">
											{createdApiKey || "Loading..."}
										</code>
										<Button
											variant="ghost"
											size="sm"
											onClick={handleCopyApiKey}
											className="text-muted-foreground hover:text-foreground p-2 h-8 w-8"
										>
											{apiKeyCopied ? (
												<Check2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
											) : (
												<Copy2 className="w-3 h-3" />
											)}
										</Button>
									</div>
									{apiKeyCopied && (
										<div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2 animate-in fade-in duration-200">
											API key copied to clipboard!
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					<div className="border-t border-dashed border-border"></div>

					{/* Step 2: Send Email */}
					<div
						className={`max-w-4xl mx-auto px-20 py-16 transition-opacity duration-300 ${
							currentStep < 2 ? "opacity-40" : ""
						}`}
					>
						<div className="flex items-center gap-3 mb-4">
							<h2 className="text-xl font-semibold text-foreground tracking-[-0.02em]">
								Send an email
							</h2>
							{emailSent ? (
								<div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200 dark:border-emerald-800">
									<span>Sent</span>
									<Check2 className="w-3 h-3" />
								</div>
							) : (
								<div className="flex items-center gap-2 text-muted-foreground px-3 py-1 rounded-full text-xs font-medium">
									<span>Ready to run</span>
									<div className="w-3 h-3 border-2 border-border rounded-full border-dashed" />
								</div>
							)}
						</div>

						<p className="text-sm text-muted-foreground font-medium tracking-[-0.02em] mb-6">
							Now you can send your first email! Just click the run button
							below.
						</p>

						<div className="bg-gray-900 dark:bg-black rounded-lg p-6 font-mono text-xs text-white relative">
							<div className="absolute top-4 right-4 flex gap-2">
								<Button
									variant="ghost"
									size="sm"
									className="text-gray-400 hover:text-white p-1 h-auto"
									onClick={handleRunCode}
									disabled={
										isRunning || !createdApiKey || !demoEmail || currentStep < 2
									}
								>
									<CirclePlay className="w-3 h-3" />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="text-gray-400 hover:text-white p-1 h-auto"
								>
									<Copy2 className="w-3 h-3" />
								</Button>
							</div>
							<div className="space-y-2 pr-20">
								<div className="text-gray-400">
									// Now you can send your first email!
								</div>
								<div className="text-gray-400">
									// Just click the run button below!
								</div>
								<div className="mt-4"></div>
								<div>
									<span className="text-blue-400">import</span> {"{ Inbound }"}{" "}
									<span className="text-blue-400">from</span>{" "}
									<span className="text-green-400">'inboundemail'</span>
								</div>
								<div className="mt-2"></div>
								<div>
									<span className="text-blue-400">const</span> inbound ={" "}
									<span className="text-blue-400">new</span>{" "}
									<span className="text-yellow-400">Inbound</span>({"{"})
								</div>
								<div className="ml-4">
									apiKey:{" "}
									<span className="text-green-400">
										'
										{createdApiKey
											? createdApiKey.slice(0, 8) + "..."
											: "your-api-key"}
										'
									</span>
								</div>
								<div>{"}"}</div>
								<div className="mt-2"></div>
								<div className="text-gray-400">// Simple email</div>
								<div>
									<span className="text-blue-400">const</span> {"{ id }"} ={" "}
									<span className="text-blue-400">await</span> inbound.emails.
									<span className="text-yellow-400">send</span>({"{"})
								</div>
								<div className="ml-4">
									from:{" "}
									<span className="text-green-400">'agent@inbnd.dev'</span>,
								</div>
								<div className="ml-4 flex items-center gap-1">
									to:
									<input
										type="email"
										value={demoEmail}
										onChange={(e) => setDemoEmail(e.target.value)}
										placeholder="you@example.com"
										disabled={currentStep < 2}
										className="inline-block w-60 h-4 bg-gray-900 border border-gray-600 text-green-400 rounded text-xs px-1 mx-1"
										style={{
											fontSize: "0.75rem",
											lineHeight: "1rem",
										}}
									/>
									<span className="text-white">,</span>
								</div>
								<div className="ml-4">
									subject:{" "}
									<span className="text-green-400">'Welcome to Inbound'</span>,
								</div>
								<div className="ml-4">
									text:{" "}
									<span className="text-green-400">
										'Thanks for signing up! What is your favorite email client?'
									</span>
									,
								</div>
								<div className="ml-4">
									html:{" "}
									<span className="text-green-400">
										'&lt;p&gt;Thanks for signing up! What is your favorite email
										client?&lt;/p&gt;'
									</span>
								</div>
								<div>{"}"}</div>
								<div className="mt-2"></div>
								<div>
									console.<span className="text-yellow-400">log</span>(
									<span className="text-green-400">'Email sent:'</span>, id)
								</div>
							</div>
						</div>
					</div>

					<div className="border-t border-dashed border-border"></div>

					{/* Step 3: Terminal Output */}
					<div
						className={`max-w-4xl mx-auto px-20 py-16 transition-opacity duration-300 ${
							currentStep < 3 ? "opacity-40" : ""
						}`}
					>
						<div className="flex items-center gap-3 mb-4">
							<h2 className="text-xl font-semibold text-foreground tracking-[-0.02em]">
								Running...
							</h2>
							{currentStep >= 3 && isRunning ? (
								<div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-medium border border-blue-200 dark:border-blue-800">
									<span>Executing</span>
									<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
								</div>
							) : currentStep >= 3 && !isRunning ? (
								<div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200 dark:border-emerald-800">
									<span>Complete</span>
									<Check2 className="w-3 h-3" />
								</div>
							) : (
								<div className="flex items-center gap-2 text-muted-foreground px-3 py-1 rounded-full text-xs font-medium">
									<span>Waiting</span>
									<div className="w-3 h-3 border-2 border-border rounded-full border-dashed" />
								</div>
							)}
						</div>

						<div className="bg-black rounded-lg p-6 font-mono text-xs text-green-400">
							<div className="space-y-1">
								{demoOutput ? (
									<>
										<div className="text-muted-foreground mb-1">
											$ inbound.emails.send( {demoEmail} )
										</div>
										<div className="whitespace-pre-wrap text-green-400">
											{demoOutput}
										</div>
										{isListeningForReply && (
											<div className="flex items-center gap-2 mt-2">
												<div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full"></div>
												<span className="text-yellow-400">
													Listening for reply... ({pollTimeLeft}s remaining)
												</span>
											</div>
										)}
										{showManualCheck && !replyReceived && (
											<div className="mt-2">
												<button
													onClick={handleManualCheck}
													disabled={isManualChecking}
													className="bg-gray-800 hover:bg-gray-700 text-green-400 px-3 py-1 rounded text-xs border border-gray-600"
												>
													{isManualChecking ? "Checking..." : "Check for Reply"}
												</button>
											</div>
										)}
										{replyReceived && (
											<div className="mt-3 bg-gray-900 border border-gray-700 rounded p-3">
												<div className="text-green-400 text-xs font-bold mb-2 flex items-center gap-2">
													📧 Reply Details
												</div>
												<div className="text-white text-xs space-y-1">
													<div className="flex gap-2">
														<span className="text-blue-400 font-medium min-w-[50px]">
															From:
														</span>
														<span className="text-yellow-400">
															{replyReceived.from}
														</span>
													</div>
													<div className="flex gap-2">
														<span className="text-blue-400 font-medium min-w-[50px]">
															Subject:
														</span>
														<span className="text-yellow-400">
															{replyReceived.subject}
														</span>
													</div>
													<div className="flex gap-2">
														<span className="text-blue-400 font-medium min-w-[50px]">
															Body:
														</span>
														<span className="text-white break-words">
															{replyReceived.body
																.split("\n\n")
																.slice(0, 5)
																.join("\n\n")}
														</span>
													</div>
												</div>
											</div>
										)}
									</>
								) : currentStep >= 3 ? (
									<>
										<div>$ bun email-demo.ts</div>
										<div>Starting email service...</div>
										<div>Connecting to inbound API...</div>
										<div>✓ Connected successfully</div>
										<div>Sending email...</div>
										<div>Email sent: msg_1a2b3c4d5e6f</div>
										{!emailReceived && (
											<div className="animate-pulse">Awaiting reply...</div>
										)}
										{emailReceived && (
											<>
												<div>✓ Email received!</div>
												<div className="text-yellow-400">
													Subject: Re: Welcome to Inbound
												</div>
												<div className="text-yellow-400">
													From: user@example.com
												</div>
											</>
										)}
									</>
								) : (
									<div className="text-muted-foreground">
										Terminal output will appear here...
									</div>
								)}
							</div>
						</div>
					</div>

					<div className="border-t border-dashed border-border"></div>

					{/* Step 4: Email Received */}
					<div
						className={`max-w-4xl mx-auto px-20 py-16 transition-opacity duration-300 ${
							currentStep < 4 ? "opacity-40" : ""
						}`}
					>
						<div className="flex items-center gap-3 mb-4">
							<h2 className="text-xl font-semibold text-foreground tracking-[-0.02em]">
								Email received!
							</h2>
							{emailReceived ? (
								<div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200 dark:border-emerald-800">
									<span>Success</span>
									<Check2 className="w-3 h-3" />
								</div>
							) : (
								<div className="flex items-center gap-2 text-muted-foreground px-3 py-1 rounded-full text-xs font-medium">
									<span>Waiting</span>
									<div className="w-3 h-3 border-2 border-border rounded-full border-dashed" />
								</div>
							)}
						</div>

						<p className="text-sm text-muted-foreground font-medium tracking-[-0.02em] mb-6">
							Great! You've received a typesafe webhook with full email data -
							HTML, plain text, headers, and more.
						</p>

						{replyReceived ? (
							<>
								<div className="bg-muted/50 rounded-lg p-6 border border-border">
									<div className="space-y-3">
										<div className="flex justify-between items-start">
											<div>
												<div className="font-semibold text-sm text-foreground">
													{replyReceived.subject}
												</div>
												<div className="text-xs text-muted-foreground">
													From: {replyReceived.from}
												</div>
											</div>
											<div className="text-xs text-muted-foreground">
												Just now
											</div>
										</div>
										<div className="text-sm text-muted-foreground">
											{replyReceived.body
												.split("\n\n")
												.slice(0, 3)
												.join("\n\n")}
										</div>
									</div>
								</div>

								<div className="mt-8">
									<Button
										className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-medium text-sm flex items-center gap-2"
										onClick={() => router.push("/add?onboarding=true")}
									>
										Continue to dashboard
										<ArrowBoldRight className="w-3 h-3" />
									</Button>
								</div>
							</>
						) : (
							<div className="bg-muted/50 rounded-lg p-6 border border-border">
								<div className="text-sm text-muted-foreground">
									{demoOutput && demoOutput.includes("✅ Success!")
										? "Waiting for reply... Check your email and reply to see the webhook data here!"
										: "Email content will appear here..."}
								</div>
							</div>
						)}
					</div>
				</div>

				<div className="border-l border-dashed border-border"></div>

				{/* Right Sidebar */}
				<div className="w-80 px-12 py-12 bg-muted/20">
					<div className="space-y-8">
						<div className="bg-card rounded-lg p-4 border border-border shadow-sm">
							<div className="font-semibold text-sm text-foreground mb-3">
								Video Tutorial
							</div>
							<a
								href="https://youtu.be/MOi19cSQdRI"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 text-xs text-primary hover:underline font-medium"
							>
								<CirclePlay width={14} height={14} />
								Watch setup tutorial
							</a>
							<p className="text-xs text-muted-foreground font-medium tracking-[-0.02em] mt-2">
								Learn how to set up and use Inbound in this step-by-step video
								guide.
							</p>
						</div>

						<div className="bg-card rounded-lg p-4 border border-border shadow-sm">
							<div className="font-semibold text-sm text-foreground mb-2">
								inbound Email SDK
							</div>
							<p className="text-xs text-muted-foreground font-medium tracking-[-0.02em]">
								Send and receive emails via SDK/API with typesafe webhooks. Get
								full email data including HTML, plain text, raw content, and
								headers.
							</p>
						</div>

						<div className="bg-card rounded-lg p-4 border border-border shadow-sm">
							<div className="font-semibold text-sm text-foreground mb-2">
								Typesafe Webhooks
							</div>
							<p className="text-xs text-muted-foreground font-medium tracking-[-0.02em]">
								Receive fully typed webhook payloads with complete email
								information. No guessing - you get every detail for maximum
								observability.
							</p>
						</div>

						<div className="bg-card rounded-lg p-4 border border-border shadow-sm">
							<div className="font-semibold text-sm text-foreground mb-2">
								Maximum Observability
							</div>
							<p className="text-xs text-muted-foreground font-medium tracking-[-0.02em]">
								Access HTML content, plain text, raw email data, and full
								headers. Perfect for debugging, analytics, and building
								intelligent email workflows.
							</p>
						</div>

						<div className="bg-card rounded-lg p-4 border border-border shadow-sm">
							<div className="font-semibold text-sm text-foreground mb-2">
								Quick Integration
							</div>
							<p className="text-xs text-muted-foreground font-medium tracking-[-0.02em]">
								Get started in minutes with inbound's simple SDK. Send your
								first email and start receiving webhooks immediately.
							</p>
						</div>
					</div>
				</div>
			</div>
			<Toaster />
		</div>
	);
}

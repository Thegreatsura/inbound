"use client";

import { useState } from "react";

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

type TabKey = keyof typeof codeExamples;

export function CodeTabs() {
	const [activeTab, setActiveTab] = useState<TabKey>("send");

	return (
		<div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-xl overflow-hidden">
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
												<span key={j} className="text-[#7c3aed] font-medium">
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
								{i < codeExamples[activeTab].code.split("\n").length - 1 &&
									"\n"}
							</span>
						);
					})}
				</code>
			</pre>
		</div>
	);
}

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
  const [activeTab, setActiveTab] = useState<"send" | "receive" | "threads">(
    "send"
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
      const emailData = data as { from: string; subject: string; preview: string; timestamp: string; emailId?: string };
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
      code: `const { data, error } = await inbound.email.send({
  from: 'Acme <hello@acme.com>',
  to: ['customer@example.com'],
  subject: 'Welcome to Acme!',
  html: '<p>Thanks for signing up.</p>'
})

console.log('Email sent:', data.id)`,
    },
    receive: {
      comment: "// Receive emails via webhook",
      code: `export async function POST(req) {
  const { from, subject, body } = await req.json()

  // Process the email
  await handleEmail({ from, subject, body })

  // Reply to the thread
  await inbound.reply(from, 'Got it, thanks!')
}`,
    },
    threads: {
      comment: "// List conversation threads",
      code: `const { data: threads } = await inbound.thread.list({
  unread: true,
  limit: 10
})

threads.forEach(thread => {
  console.log(thread.normalizedSubject)
  console.log(\`\${thread.messageCount} messages\`)
})`,
    },
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#1c1917] selection:bg-[#8161FF]/20">
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
              <button
                onClick={() => generateEmail(true)}
                className="bg-[#8161FF] hover:bg-[#6b4fd9] text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 flex-shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm font-medium">New</span>
              </button>
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
                  onClick={() => setActiveTab("threads")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activeTab === "threads"
                      ? "bg-white text-[#1c1917] shadow-sm"
                      : "text-[#52525b] hover:text-[#1c1917]"
                  }`}
                >
                  threads
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
                      "<kw>$1</kw>"
                    )
                    .replace(/'([^']*)'/g, "<str>'$1'</str>")
                    .replace(/`([^`]*)`/g, "<str>`$1`</str>")
                    .replace(/\/\/.*/g, "<cmt>$&</cmt>")
                    .replace(/\b(console)\b/g, "<obj>$1</obj>")
                    .replace(
                      /\.(send|email|reply|thread|list|log|json|forEach)\b/g,
                      ".<fn>$1</fn>"
                    );

                  return (
                    <span key={i}>
                      {highlightedLine
                        .split(
                          /(<kw>.*?<\/kw>|<str>.*?<\/str>|<cmt>.*?<\/cmt>|<obj>.*?<\/obj>|<fn>.*?<\/fn>)/
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

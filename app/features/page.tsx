import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"

import PaperPlane2 from "@/components/icons/paper-plane-2"
import InboxArrowDown from "@/components/icons/inbox-arrow-down"
import Envelope2 from "@/components/icons/envelope-2"
import Code2 from "@/components/icons/code-2"
import ShieldCheck from "@/components/icons/shield-check"
import Microchip from "@/components/icons/microchip"
import CircleCheck from "@/components/icons/circle-check"

export default function FeaturesPage() {
  const highlightCards: Array<{
    title: string
    description: string
    bullets: string[]
    Icon: React.ComponentType<any>
  }> = [
    {
      title: "Transactional sending",
      description:
        "Reliable API for receipts, notifications, and transactional messages at scale.",
      bullets: ["Templates and variables", "Attachments", "Bounce handling"],
      Icon: PaperPlane2,
    },
    {
      title: "Inbound as webhooks",
      description:
        "Receive email to your endpoints with structured JSON for headers, text, HTML, and files.",
      bullets: ["Automatic parsing", "Attachment handling", "Custom routing"],
      Icon: InboxArrowDown,
    },
    {
      title: "Threaded conversations",
      description:
        "Group messages into conversation threads for full context across replies and participants.",
      bullets: ["Smart threading", "Reply detection", "Conversation history"],
      Icon: Envelope2,
    },
    {
      title: "Webhooks & retries",
      description:
        "Deliver events to your services with robust retry logic and delivery logs.",
      bullets: ["Exponential backoff", "Delivery logs", "Per-endpoint secrets"],
      Icon: Code2,
    },
    {
      title: "Security by default",
      description:
        "Protect your integration with API keys, HMAC signatures, and rate limits.",
      bullets: ["HMAC signatures", "Domain verification", "Rate limiting"],
      Icon: ShieldCheck,
    },
    {
      title: "AI-assisted workflows",
      description:
        "Use AI to classify, summarize, and draft replies with full thread context.",
      bullets: ["Classification", "Summaries", "Suggested replies"],
      Icon: Microchip,
    },
  ]

  const everythingIncluded: string[] = [
    "TypeScript SDK and REST API",
    "Open/click tracking (via dub.co)",
    "Configurable endpoints and routing",
    "Spam filtering and suppression list",
    "Domain setup with DKIM/SPF helpers",
    "Detailed logs and metrics",
    "Modern dashboard with search",
    "Examples and guides to get started",
  ]

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <SiteHeader />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl leading-tight mb-4">Features</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            The all‑in‑one email platform for developers. Send transactional emails, receive
            inbound messages as webhooks, and build AI‑powered workflows—all in one place.
          </p>
        </div>
      </section>

      {/* Highlights grid */}
      <section className="max-w-7xl mx-auto px-6 pb-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {highlightCards.map(({ title, description, bullets, Icon }) => (
            <div key={title} className="bg-card border border-border border-dotted rounded-none p-6">
              <div className="w-12 h-12 border border-border border-dotted rounded-none flex items-center justify-center mb-4">
                <Icon width="18" height="18" className="text-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{description}</p>
              <ul className="space-y-2">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CircleCheck width="14" height="14" className="mt-0.5 text-foreground" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Everything included */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-muted/30 border border-dotted rounded-none p-8">
          <h2 className="text-2xl font-semibold mb-4 text-center">Everything included</h2>
          <div className="grid md:grid-cols-2 gap-3 max-w-4xl mx-auto">
            {everythingIncluded.map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CircleCheck width="14" height="14" className="mt-0.5 text-foreground" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="border border-dotted rounded-none p-10 text-center">
          <h2 className="text-3xl font-bold mb-4">Build better email experiences</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Start free, integrate in minutes, and scale with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" asChild>
              <Link href="/login">Get started</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs">Read the docs</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

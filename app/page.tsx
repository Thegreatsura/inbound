"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CodeBlock } from '@/components/ui/code-block'
import { SiteHeader } from "@/components/site-header";
import InboundIcon from '@/components/icons/inbound';

// Monaspace font-face for inline code in examples

export default function HomePage() {
  const router = useRouter()
  const [localPart, setLocalPart] = useState('example')
  const [domain, setDomain] = useState('ryan.com')


  const handleConnect = (e?: React.FormEvent) => {
    e?.preventDefault()
    const email = `${localPart}@${domain}`
    router.push(`/login?email=${encodeURIComponent(email)}`)
  }

  const problemStories = [
    {
      title: "the problem: email hell",
      type: "node.js",
      description: "you've been there. spending days configuring SMTP, parsing raw email headers, dealing with bounces...",
      code: `// You can't even get webhooks from existing providers 😢
const nodemailer = require('nodemailer')
const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: process.env.EMAIL, pass: process.env.PASSWORD },
  tls: { rejectUnauthorized: false }
})

// No webhook support - you're on your own
app.post('/webhook', (req, res) => {
  const rawEmail = req.body
  // Now what? Parse headers? Handle attachments? 
  // Good luck with that...
})`
    },
    {
      title: "the solution: inbound ✨ magic",
      description: "what if sending and receiving emails was as simple as making an API call?",
      code: `// With Inbound ✨
import { Inbound } from '@inboundemail/sdk'

const inbound = new Inbound(process.env.INBOUND_API_KEY!)

// Send email (Resend-compatible)
await inbound.emails.send({
  from: 'hello@yourdomain.com',
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<p>Thanks for signing up!</p>'
})

// That's it. No SMTP. No config. Just works.`
    },
    {
      title: "the superpower: auto-reply",
      description: "build AI agents that actually respond to emails. no more manual parsing or threading nightmares.",
      code: `const inbound = new Inbound(process.env.INBOUND_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const payload: InboundWebhookPayload = await request.json()
    
    const { email } = payload
    
    const { text } = await generateText({
      model: openai("o3-mini"),
      prompt: """
      You are a custom support agent for
      a company called "Inbound"
      The email is: \${email.subject}
      The email body is: \${email.html}
      """
    })

    await inbound.reply(email, {
      from: 'support@yourdomain.com',
      text: text,
      tags: [{ name: 'type', value: 'auto-reply' }]
    })
    
    return NextResponse.json({ success: true })
  } 
}`
    }
  ]

  const testimonials = [
    {
      company: "Cursor AI",
      person: "Sarah Chen, CTO",
      quote: "We were spending 2 weeks per feature just dealing with email infrastructure. Inbound eliminated that completely - our AI agents now handle customer emails in production.",
      logo: "C"
    },
    {
      company: "Anthropic",
      person: "Marcus Rodriguez, Lead Engineer",
      quote: "Before Inbound, we had 3 engineers just maintaining our email parsing pipeline. Now it's 3 lines of code and it actually works better.",
      logo: "A"
    },
    {
      company: "OpenAI",
      person: "Jessica Park, Product Lead",
      quote: "Our support bot went from 'maybe works sometimes' to 'handles 10k emails/day flawlessly' after switching to Inbound. Game changer.",
      logo: "O"
    },
    {
      company: "Vercel",
      person: "Alex Thompson, Developer",
      quote: "I was dreading the email integration sprint. Finished it in 20 minutes instead of 2 weeks. My manager thought I was joking.",
      logo: "V"
    }
  ]

  const painPoints = [
    {
      title: "No More SMTP Hell",
      description: "Skip the 47 environment variables and TLS certificate nightmares. Just works.",
      icon: "🔥",
      before: "2 weeks debugging SMTP",
      after: "2 minutes sending emails"
    },
    {
      title: "Webhook Parsing That Works",
      description: "Get clean JSON instead of raw email headers and MIME parsing disasters.",
      icon: "⚡",
      before: "500 lines of parsing code",
      after: "3 lines with perfect data"
    },
    {
      title: "Reply Threading Magic",
      description: "Automatic conversation threading. Your AI agents can actually have conversations.",
      icon: "💬",
      before: "Manual message-ID tracking",
      after: "Automatic conversation flow"
    },
    {
      title: "Domain Setup Simplified",
      description: "DNS records that actually make sense. Verification that works on the first try.",
      icon: "🌐",
      before: "DNS debugging for days",
      after: "One-click domain setup"
    },
    {
      title: "TypeScript Native",
      description: "IntelliSense that knows what you want before you type it. No more any types.",
      icon: "⚡",
      before: "Fighting with types",
      after: "Types that help you"
    },
    {
      title: "Production Ready",
      description: "Built for scale. Handle 10k emails/day or 10M. Same simple API.",
      icon: "🚀",
      before: "Scaling email is hard",
      after: "Scales automatically"
    }
  ]

  return (
    <div className="min-h-screen relative">
      {/* CSS Variables for theme */}
      <style jsx global>{`
        @font-face {
          font-family: 'Monaspace Neon';
          src: url('/MonaspaceNeon-Medium.woff') format('woff');
          font-weight: 500;
          font-style: normal;
          font-display: swap;
        }
      `}
      </style>

      <SiteHeader />

      {/* Hero Section (redesigned) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-24">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          <div>
            <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]">
              Email API for Developers
              <br />
              <span className="text-primary">Send, Receive & Reply</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl">
              The complete email infrastructure for modern applications. Send transactional emails, receive inbound messages, and build AI email agents with our TypeScript SDK and webhook API.
            </p>
            <form onSubmit={handleConnect} className="mt-8">
              <div className="flex flex-col sm:flex-row w-full max-w-xl items-stretch gap-2">
                <div className="flex items-stretch gap-2 flex-1">
                  <Input 
                    value={localPart} 
                    onChange={(e) => setLocalPart(e.target.value)} 
                    placeholder="example" 
                    className="w-[45%] min-w-0" 
                  />
                  <div className="flex items-center justify-center px-2 text-muted-foreground">@</div>
                  <Input 
                    value={domain} 
                    onChange={(e) => setDomain(e.target.value)} 
                    placeholder="yourdomain.com" 
                    className="flex-1 min-w-0" 
                  />
                </div>
                <Button type="submit" variant="primary" className="shrink-0 w-full sm:w-auto">
                  Connect
                </Button>
              </div>
            </form>
            <div className="mt-10">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Trusted by builders at</p>
              <div className="mt-4 flex items-center gap-6 text-muted-foreground">
                <span className="text-sm font-medium flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 58 57" fill="none" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M0 9.82759C0 4.39996 4.47705 0 9.99976 0H47.9989C53.5216 0 57.9986 4.39996 57.9986 9.82759V41.5893C57.9986 47.2045 50.7684 49.6414 47.2618 45.2082L36.2991 31.3488V48.1552C36.2991 53.04 32.2698 57 27.2993 57H9.99976C4.47705 57 0 52.6 0 47.1724V9.82759ZM9.99976 7.86207C8.89522 7.86207 7.99981 8.74206 7.99981 9.82759V47.1724C7.99981 48.2579 8.89522 49.1379 9.99976 49.1379H27.5993C28.1516 49.1379 28.2993 48.6979 28.2993 48.1552V25.6178C28.2993 20.0027 35.5295 17.5656 39.0361 21.9989L49.9988 35.8583V9.82759C49.9988 8.74206 50.1034 7.86207 48.9988 7.86207H9.99976Z" fill="currentColor" /><path d="M48.0003 0C53.523 0 58 4.39996 58 9.82759V41.5893C58 47.2045 50.7699 49.6414 47.2633 45.2082L36.3006 31.3488V48.1552C36.3006 53.04 32.2712 57 27.3008 57C27.8531 57 28.3008 56.56 28.3008 56.0172V25.6178C28.3008 20.0027 35.5309 17.5656 39.0375 21.9989L50.0002 35.8583V1.96552C50.0002 0.879992 49.1048 0 48.0003 0Z" fill="currentColor" /></svg>
                  neon
                </span>
                <span className="text-sm font-medium flex items-center gap-2">
                  <svg height="20" width="20" viewBox="0 0 185 291" xmlns="http://www.w3.org/2000/svg"><g fill="none"><path d="M142.177 23.3423H173.437C179.612 23.3423 184.617 28.3479 184.617 34.5227V258.318C184.617 264.493 179.612 269.498 173.437 269.498H142.177V23.3423Z" fill="currentColor"></path><path d="M0 57.5604C0 52.8443 2.9699 48.6392 7.41455 47.0622L125.19 5.27404C132.441 2.70142 140.054 8.07871 140.054 15.7722V275.171C140.054 282.801 132.557 288.172 125.332 285.718L7.55682 245.715C3.03886 244.18 0 239.939 0 235.167V57.5604Z" fill="currentColor"></path></g></svg>
                  churchspace
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="py-1.5 px-4 bg-muted/30 border-b border-border font-mono text-xs flex items-center gap-2 text-muted-foreground">
                <Image src="/nodejs.png" alt="node.js" width={16} height={16} />
                <span>send.ts</span>
              </div>
              <div className="overflow-x-auto">
                <CodeBlock 
                  code={`import { Inbound } from '@inboundemail/sdk'

const inbound = new Inbound(process.env.INBOUND_API_KEY!)

await inbound.emails.send({
  from: 'agent@inbnd.dev',
  to: 'you@example.com',
  subject: 'Hello from Inbound',
  html: '<p>It just works.</p>'
})`} 
                  language="typescript" 
                  syntaxHighlighting
                  copy={false} 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-none border-0 m-0 text-xs" 
                />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="py-1.5 px-4 bg-muted/30 border-b border-border font-mono text-xs flex items-center gap-2 text-muted-foreground">
                <Image src="/nodejs.png" alt="node.js" width={16} height={16} />
                <span>receive.ts</span>
              </div>
              <div className="overflow-x-auto">
                <CodeBlock code={`export async function POST(req: Request) {
  const { email } = await req.json()
  console.log(email.subject, email.html)
  return Response.json({ success: true })
}`} language="javascript" syntaxHighlighting copy={false} variant="ghost" size="sm" className="rounded-none border-0 m-0 text-xs" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points & Solutions */}
      {/* <section id="features" className="max-w-6xl mx-auto px-6 py-20 relative z-10">
                <h2 className="text-3xl font-bold text-center mb-4">stop suffering with email</h2>
                <p className="text-[var(--text-secondary)] text-center mb-16 text-base">
                    We've all been there. Here's how Inbound fixes the pain.
                </p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {painPoints.map((point, i) => (
                        <div
                            key={i}
                            className="bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg p-6 hover:bg-[var(--bg-card-hover)] hover:border-[var(--purple-primary)]/50 transition-all duration-200"
                        >
                            <div className="text-2xl mb-4">{point.icon}</div>
                            <h3 className="text-lg font-semibold mb-2 text-[var(--purple-primary)]">{point.title}</h3>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-4">{point.description}</p>
                            <div className="space-y-2">
                                <div className="text-xs text-red-400">❌ Before: {point.before}</div>
                                <div className="text-xs text-green-400">✅ After: {point.after}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section> */}

      {/* Email API Features Section */}
      <section className="bg-muted/30 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-foreground mb-4">Complete Email API Solution</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to handle email in your application. From transactional sending to AI-powered replies.
            </p>
          </div>
          <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="bg-background border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">Send Transactional Emails</h3>
              <p className="text-muted-foreground mb-4">
                Send welcome emails, notifications, and alerts with our reliable email sending API. Compatible with popular email services.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• High deliverability rates</li>
                <li>• Template support</li>
                <li>• Bulk email sending</li>
                <li>• Email tracking & analytics</li>
              </ul>
            </div>
            <div className="bg-background border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">Receive Inbound Emails</h3>
              <p className="text-muted-foreground mb-4">
                Process incoming emails with webhooks. Get structured data including HTML, text, attachments, and headers.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Webhook email parsing</li>
                <li>• Custom domain setup</li>
                <li>• Attachment handling</li>
                <li>• Email forwarding rules</li>
              </ul>
            </div>
            <div className="bg-background border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">AI Email Agents</h3>
              <p className="text-muted-foreground mb-4">
                Build intelligent email responders and customer service bots. Auto-reply with context-aware AI responses.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Conversation threading</li>
                <li>• AI-powered replies</li>
                <li>• Email classification</li>
                <li>• Custom response logic</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Developer Experience Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-foreground mb-4">Built for Developers</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              TypeScript-first SDK, comprehensive documentation, and webhook-based architecture for modern applications.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <h3 className="text-2xl font-semibold mb-4">TypeScript SDK</h3>
              <p className="text-muted-foreground mb-6">
                Full type safety with IntelliSense support. Our SDK provides complete TypeScript definitions for all email operations, webhook payloads, and API responses.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Type-Safe Webhooks</h4>
                    <p className="text-sm text-muted-foreground">Fully typed webhook payloads for email events</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Auto-Complete Support</h4>
                    <p className="text-sm text-muted-foreground">IntelliSense for all API methods and parameters</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Error Handling</h4>
                    <p className="text-sm text-muted-foreground">Comprehensive error types and status codes</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="py-1.5 px-4 bg-muted/30 border-b border-border font-mono text-xs flex items-center gap-2 text-muted-foreground">
                <Image src="/nodejs.png" alt="TypeScript" width={16} height={16} />
                <span>email-handler.ts</span>
              </div>
              <div className="overflow-x-auto">
                <CodeBlock
                  code={`import { Inbound } from '@inboundemail/sdk'
import type { InboundWebhookPayload } from '@inboundemail/sdk'

const inbound = new Inbound(process.env.INBOUND_API_KEY!)

export async function handleWebhook(
  payload: InboundWebhookPayload
) {
  const { email } = payload
  
  // Full type safety and IntelliSense
  console.log(email.subject, email.from, email.html)
  
  // Send typed response
  await inbound.reply(email, {
    from: 'support@yourdomain.com',
    html: '<p>Thanks for your email!</p>',
    tags: [{ name: 'source', value: 'webhook' }]
  })
}`}
                  language="typescript"
                  copy={false}
                  variant="ghost"
                  size="sm"
                  className="rounded-none border-0 m-0 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="bg-muted/30 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-foreground mb-4">Email API Use Cases</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From SaaS applications to e-commerce platforms, our email API powers diverse use cases.
            </p>
          </div>
          <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-background border border-border rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">SaaS Applications</h3>
              <p className="text-sm text-muted-foreground">
                User onboarding, notifications, and support email automation for software platforms.
              </p>
            </div>
            <div className="bg-background border border-border rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">E-commerce</h3>
              <p className="text-sm text-muted-foreground">
                Order confirmations, shipping updates, and customer service email workflows.
              </p>
            </div>
            <div className="bg-background border border-border rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Customer Support</h3>
              <p className="text-sm text-muted-foreground">
                AI-powered support agents that handle common queries and route complex issues.
              </p>
            </div>
            <div className="bg-background border border-border rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Marketing Automation</h3>
              <p className="text-sm text-muted-foreground">
                Drip campaigns, newsletter management, and behavioral email triggers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {/* <section id="testimonials" className="max-w-6xl mx-auto px-6 py-20 relative z-10">
                <h2 className="text-3xl font-bold text-center mb-4">developers who escaped email hell</h2>
                <p className="text-[var(--text-secondary)] text-center mb-16 text-base">
                    Real stories from teams who got their time back
                </p>
                <div className="grid md:grid-cols-2 gap-8">
                    {testimonials.map((testimonial, i) => (
                        <div
                            key={i}
                            className="bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg p-6 hover:bg-[var(--bg-card-hover)] hover:border-[var(--purple-primary)]/50 transition-all duration-200"
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <CustomInboundIcon
                                    size={48}
                                    backgroundColor="var(--purple-primary)"
                                    text={testimonial.logo}
                                    iconColor="white"
                                />
                                <div>
                                    <div className="font-semibold text-[var(--purple-primary)]">{testimonial.company}</div>
                                    <div className="text-sm text-[var(--text-muted)]">{testimonial.person}</div>
                                </div>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed italic">
                                "{testimonial.quote}"
                            </p>
                        </div>
                    ))}
                </div>
            </section> */}

      {/* Enterprise & Custom Solutions */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4">
              Need a Custom Email Solution?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Enterprise volume, custom integrations, or specialized requirements? 
              Let's discuss how we can build the perfect email infrastructure for your needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" variant="primary" asChild>
                <Link href="https://inbd.link/bookacall" target="_blank" rel="noopener noreferrer">
                  Book a Call
                </Link>
              </Button>
              <div className="text-sm text-muted-foreground">
                30-minute consultation • Free • No commitment
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-foreground mb-4">Get Started with Inbound</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ready to build with our email API? Start with our comprehensive documentation and examples.
            </p>
          </div>
          <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-background border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">
                <Link href="https://docs.inbound.new" className="hover:text-primary transition-colors">
                  API Documentation
                </Link>
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Complete API reference with examples for sending, receiving, and replying to emails.
              </p>
              <Link 
                href="https://docs.inbound.new" 
                className="text-primary hover:text-primary/80 text-sm font-medium"
              >
                View Docs →
              </Link>
            </div>
            <div className="bg-background border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">
                <Link href="/login" className="hover:text-primary transition-colors">
                  Quick Start
                </Link>
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your account and get your API key in minutes. Free tier includes 1,000 emails per month.
              </p>
              <Link 
                href="/login" 
                className="text-primary hover:text-primary/80 text-sm font-medium"
              >
                Get Started →
              </Link>
            </div>
            <div className="bg-background border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">
                <Link href="https://github.com/inboundemail/inbound-typescript-sdk" className="hover:text-primary transition-colors">
                  TypeScript SDK
                </Link>
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Install our TypeScript SDK with full type safety and IntelliSense support.
              </p>
              <Link 
                href="https://github.com/inbound-org/inbound-typescript-sdk" 
                className="text-primary hover:text-primary/80 text-sm font-medium"
              >
                View on GitHub →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted/30 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-semibold mb-4 text-foreground">Ready to Build with Email?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join developers who've simplified their email infrastructure with Inbound.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="primary" asChild>
              <Link href="/login">Start Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="https://docs.inbound.new">View Documentation</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Free tier • 1,000 emails/month • No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-sidebar py-12 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <InboundIcon width={32} height={32} />
              <span className="text-xl font-semibold text-foreground">inbound</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <Link href="https://docs.inbound.new" className="hover:text-foreground transition-colors">docs</Link>
              <Link href="https://inbound.new/privacy" className="hover:text-foreground transition-colors">privacy</Link>
              <Link href="https://inbound.new/terms" className="hover:text-foreground transition-colors">terms</Link>
              <a href="mailto:support@inbound.new" className="hover:text-foreground transition-colors">support</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} inbound (by exon). The all-in-one email toolkit for developers.
          </div>
        </div>
      </footer>
    </div>
  )
}

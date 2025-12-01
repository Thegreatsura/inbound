"use client";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Word pools for generating random email addresses
const adjectives = ["swift", "bright", "quick", "smart", "bold", "calm", "fresh", "keen", "neat", "pure"];
const nouns = ["fox", "owl", "bear", "hawk", "wolf", "deer", "dove", "lion", "seal", "wren"];

function generateEmailAddress() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}-${noun}-${num}@ehook.app`;
}

// Sample email that would be "received"
interface DemoEmail {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  time: string;
  avatar: string;
  read: boolean;
}

const sampleEmails: Omit<DemoEmail, "id" | "time">[] = [
  {
    from: "sarah@startup.io",
    fromName: "Sarah Chen",
    subject: "Quick question about the API",
    preview: "Hey! I was looking at your documentation and wanted to ask about the webhook...",
    avatar: "SC",
    read: false,
  },
  {
    from: "mike@acme.com",
    fromName: "Mike Johnson",
    subject: "Partnership opportunity",
    preview: "Hi there, I'm reaching out because I think there's a great opportunity for us to...",
    avatar: "MJ",
    read: true,
  },
  {
    from: "support@notion.so",
    fromName: "Notion Support",
    subject: "Your ticket has been resolved",
    preview: "Thank you for contacting Notion Support. We've resolved your issue regarding...",
    avatar: "N",
    read: true,
  },
  {
    from: "billing@aws.com",
    fromName: "AWS Billing",
    subject: "Invoice available",
    preview: "Your invoice for the billing period of August is now available...",
    avatar: "AB",
    read: true,
  },
];

export default function HomePage() {
  const [demoEmail, setDemoEmail] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [emails, setEmails] = useState<DemoEmail[]>([]);
  const [showNewEmail, setShowNewEmail] = useState(false);

  useEffect(() => {
    setDemoEmail(generateEmailAddress());
    
    // Initialize with sample emails
    const initialEmails: DemoEmail[] = sampleEmails.slice(0, 3).map((email, i) => ({
      ...email,
      id: `email-${Date.now()}-${i}`,
      time: i === 0 ? "2 min ago" : i === 1 ? "1 hr ago" : "Yesterday",
    }));
    setEmails(initialEmails);
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(demoEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = demoEmail;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Simulate receiving a new email when user "sends" one
  const simulateEmailReceived = () => {
    setShowNewEmail(true);
    
    const randomTemplate = sampleEmails[Math.floor(Math.random() * sampleEmails.length)];
    const newEmail: DemoEmail = {
      ...randomTemplate,
      id: `email-${Date.now()}`,
      time: "Just now",
      read: false,
    };
    
    setTimeout(() => {
      setEmails((prev) => [newEmail, ...prev].slice(0, 6));
      setShowNewEmail(false);
    }, 800);
  };

  return (
    <div className="min-h-screen relative bg-white selection:bg-purple-100 selection:text-purple-900">
      <SiteHeader />
      
      {/* Enhanced Background Gradient */}
      <div className="absolute top-0 left-0 right-0 h-[80vh] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      <main className="relative">
        {/* Hero Section */}
        <section className="max-w-5xl mx-auto px-4 pt-12 pb-12 md:pt-24 md:pb-20 relative z-10">
          <div className="flex flex-col items-center text-center gap-6">
            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter text-foreground max-w-4xl leading-[1.1] md:leading-[1.1]">
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  Email infrastructure
                </span>
                <br />
                for builders
              </h1>
              {/* Glow behind text */}
              <div className="absolute -inset-x-20 -inset-y-10 bg-purple-200/20 blur-3xl -z-10 rounded-[100%]" />
            </motion.div>

            {/* Subline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-lg md:text-xl text-muted-foreground/80 max-w-xl tracking-tight leading-relaxed font-medium"
            >
              Send an email to your inbox and watch it arrive in real-time. 
              Complete email infrastructure with zero setup.
            </motion.p>

            {/* Command Bar Style Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-md mt-4"
            >
              <div className="relative group">
                {/* Glow Effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl blur opacity-50 group-hover:opacity-100 transition duration-500" />
                
                <button
                  onClick={copyToClipboard}
                  className="relative w-full flex items-center justify-between gap-3 px-2 py-2 bg-white/80 backdrop-blur-xl border border-black/5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group-hover:border-purple-500/20"
                >
                  <div className="flex items-center gap-3 pl-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border border-white/50 shadow-sm shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </div>
                    <div className="flex flex-col items-start text-left min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Demo Email Address</span>
                      <code className="text-sm font-mono text-foreground/90 tracking-tight truncate w-full">
                        {demoEmail || "generating..."}
                      </code>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pr-2">
                    <div className={cn(
                      "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
                      copied 
                        ? "bg-green-50 text-green-600 border border-green-200/50" 
                        : "bg-gray-50 text-gray-600 border border-gray-200/50 group-hover:bg-white group-hover:shadow-sm"
                    )}>
                      {copied ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                          </svg>
                          <span>Copy</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex items-center gap-3 mt-4"
            >
              <Button variant="primary" size="lg" asChild className="h-10 px-6 text-sm font-medium shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-300">
                <Link href="/login">Get Started Free</Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="h-10 px-6 text-sm font-medium bg-white/50 hover:bg-white/80 backdrop-blur-sm border-gray-200 hover:border-gray-300 transition-all duration-300">
                <Link href="/docs">Read Documentation</Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* App-Like Inbox Preview */}
        <section className="max-w-6xl mx-auto px-4 pb-20 md:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="relative"
          >
            {/* Background Glows */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-200/30 blur-[100px] opacity-50 rounded-full pointer-events-none" />
            
            {/* Inbox Window */}
            <div className="relative bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-black/5 overflow-hidden ring-1 ring-black/5">
              <div className="flex h-[500px]">
                
                {/* Sidebar */}
                <div className="w-64 bg-gray-50/50 border-r border-gray-100 p-4 hidden md:flex flex-col gap-6">
                  {/* Window Controls */}
                  <div className="flex items-center gap-1.5 px-2">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F57] border border-black/5" />
                    <div className="w-3 h-3 rounded-full bg-[#FEBC2E] border border-black/5" />
                    <div className="w-3 h-3 rounded-full bg-[#28C840] border border-black/5" />
                  </div>

                  {/* Navigation */}
                  <div className="space-y-1">
                    <div className="px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-100 text-sm font-medium text-gray-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                          <rect width="20" height="16" x="2" y="4" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                        Inbox
                      </div>
                      <span className="text-xs font-semibold text-gray-500">{emails.length}</span>
                    </div>
                    <div className="px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100/50 rounded-lg flex items-center gap-2 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m22 2-7 20-4-9-9-4Z" />
                        <path d="M22 2 11 13" />
                      </svg>
                      Sent
                    </div>
                    <div className="px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100/50 rounded-lg flex items-center gap-2 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5" />
                        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                        <path d="M13.3 14.4 9 17.5l-4.3-3.1" />
                        <path d="M9 17.5V22" />
                      </svg>
                      Drafts
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col bg-white">
                  {/* Header */}
                  <div className="h-14 border-b border-gray-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                    <h2 className="font-semibold text-gray-900">Inbox</h2>
                    <button
                      onClick={simulateEmailReceived}
                      className="text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                      </svg>
                      Simulate Incoming Email
                    </button>
                  </div>

                  {/* Email List */}
                  <div className="flex-1 overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      {showNewEmail && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-b border-purple-100 bg-purple-50/30"
                        >
                          <div className="px-6 py-4 flex items-center gap-3">
                            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-purple-700 font-medium">Receiving new message...</span>
                          </div>
                        </motion.div>
                      )}
                      
                      {emails.map((email) => (
                        <motion.div
                          key={email.id}
                          layout
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "px-6 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer group relative",
                            !email.read && "bg-blue-50/10"
                          )}
                        >
                          {!email.read && (
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500" />
                          )}
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0 shadow-sm",
                              email.read ? "bg-gray-200 text-gray-500" : "bg-gradient-to-br from-blue-500 to-indigo-600"
                            )}>
                              {email.avatar}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className={cn("text-sm", !email.read ? "font-semibold text-gray-900" : "font-medium text-gray-700")}>
                                  {email.fromName}
                                </span>
                                <span className="text-xs text-gray-400 tabular-nums">{email.time}</span>
                              </div>
                              <h3 className={cn("text-sm mb-1 truncate", !email.read ? "font-medium text-gray-900" : "text-gray-600")}>
                                {email.subject}
                              </h3>
                              <p className="text-sm text-gray-500 truncate">
                                {email.preview}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Grid */}
        <section className="max-w-6xl mx-auto px-4 py-20 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-gray-900">
              Everything you need for email
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto tracking-tight">
              A complete email platform for developers to send, receive, and reply—all with a simple API.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Receive Emails",
                description: "Get emails at your custom domain, parsed and delivered to your webhook in real-time.",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                ),
              },
              {
                title: "Send Emails",
                description: "Transactional emails that land in the inbox, not spam. With detailed delivery analytics.",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 3 3 9-3 9 19-9Z" />
                    <path d="M6 12h16" />
                  </svg>
                ),
              },
              {
                title: "Reply & Threads",
                description: "Maintain conversation threads automatically. Reply to any email programmatically.",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
                  </svg>
                ),
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group p-8 bg-white border border-gray-200/60 rounded-2xl hover:border-purple-200/80 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 relative overflow-hidden"
              >
                 <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-purple-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 mb-6 group-hover:bg-purple-600 group-hover:border-purple-600 group-hover:text-white transition-all duration-300 shadow-sm">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3 tracking-tight text-gray-900">{feature.title}</h3>
                <p className="text-gray-500 text-base leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-gray-100">
          <div className="max-w-3xl mx-auto px-4 py-24 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-8"
            >
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-gray-900">
                Ready to build with email?
              </h2>
              <p className="text-xl text-gray-500 max-w-xl tracking-tight">
                Join thousands of developers using inbound to power their email workflows.
              </p>
              <div className="flex items-center gap-3">
                <Button variant="primary" size="lg" asChild className="h-12 px-8 text-base font-medium shadow-xl shadow-purple-500/20">
                  <Link href="/login">Start Building Free</Link>
                </Button>
                <Button variant="ghost" size="lg" asChild className="h-12 px-8 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                  <Link href="/pricing">View Pricing →</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-100 bg-gray-50/50">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="32" height="32" rx="8" fill="#8161FF"/>
                  <path d="M8 12L16 17L24 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 12V20L16 25V17L8 12Z" fill="white" fillOpacity="0.3"/>
                  <path d="M24 12V20L16 25V17L24 12Z" fill="white" fillOpacity="0.5"/>
                </svg>
                <span className="font-bold tracking-tight text-lg text-gray-900">inbound</span>
              </div>
              <nav className="flex items-center gap-8 text-sm font-medium text-gray-500">
                <Link href="/docs" className="hover:text-purple-600 transition-colors">Docs</Link>
                <Link href="/pricing" className="hover:text-purple-600 transition-colors">Pricing</Link>
                <Link href="/blog" className="hover:text-purple-600 transition-colors">Blog</Link>
                <a href="https://twitter.com/inboundemail" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition-colors">Twitter</a>
                <a href="https://github.com/inbound-org" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition-colors">GitHub</a>
              </nav>
              <p className="text-sm text-gray-400">
                © {new Date().getFullYear()} Inbound.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

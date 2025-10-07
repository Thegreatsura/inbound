"use client"

import { Badge } from "@/components/ui/badge"

export function Solution() {
    return (
        <section className="overflow-hidden py-16 max-md:py-12  items-center justify-center px-4 flex gap-12 relative flex-col w-full">
            {/* Header */}
            <div className="w-full flex justify-start items-center">
                <div className="rounded-lg flex flex-col items-start gap-3 sm:gap-4">
                    <Badge className="gap-2" >
                        <span className="inline-flex items-center justify-center">
                            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 2L6 6L11 2" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="1" y="2" width="10" height="6" stroke="currentColor" strokeWidth="1" fill="none" rx="1" />
                            </svg>
                        </span>
                        <span className="text-sm">Email API</span>
                    </Badge>
                    <h2 className="text-left text-foreground text-2xl md:text-3xl lg:text-5xl font-semibold leading-tight tracking-tight">
                        Complete Email API Solution
                    </h2>
                    <p className="text-left text-muted-foreground text-sm sm:text-base leading-6 sm:leading-7 tracking-normal">
                        Everything you need to handle email in your application. From transactional sending to AI-powered replies.
                    </p>
                </div>
            </div>

            {/* Features Grid */}
            <div className="w-full flex justify-center items-start">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 border border-border divide-y md:divide-y-0 md:divide-x divide-border rounded-l-2xl rounded-r-2xl overflow-hidden">
                    {/* Send Transactional Emails */}
                    <div className="flex flex-col gap-4 min-h-max md:p-6 p-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-50/70 to-blue-100/70 dark:from-blue-950/40 dark:to-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 8l12 8 12-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="4" y="8" width="24" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                <path d="M8 12h8M8 16h12M8 20h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-foreground tracking-tight">Send Transactional Emails</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed tracking-normal">
                            Send welcome emails, notifications, and alerts with our reliable email sending API. Compatible with popular email services.
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 tracking-normal">
                            <li>• High deliverability rates</li>
                            <li>• Template support</li>
                            <li>• Bulk email sending</li>
                            <li>• Email tracking & analytics</li>
                        </ul>
                    </div>

                    {/* Receive Inbound Emails */}
                    <div className="flex flex-col gap-4 min-h-max md:p-6 p-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-50/70 to-green-100/70 dark:from-green-950/40 dark:to-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M28 8L16 16L4 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="4" y="8" width="24" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                <path d="M12 18l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="8" cy="12" r="1" fill="currentColor" />
                                <circle cx="24" cy="12" r="1" fill="currentColor" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-foreground tracking-tight">Receive Inbound Emails</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed tracking-normal">
                            Process incoming emails with webhooks. Get structured data including HTML, text, attachments, and headers.
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 tracking-normal">
                            <li>• Webhook email parsing</li>
                            <li>• Custom domain setup</li>
                            <li>• Attachment handling</li>
                            <li>• Email forwarding rules</li>
                        </ul>
                    </div>

                    {/* AI Email Agents */}
                    <div className="flex flex-col gap-4 min-h-max md:p-6 p-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-50/70 to-purple-100/70 dark:from-purple-950/40 dark:to-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="6" y="10" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                <path d="M6 14l10 6 10-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="16" cy="6" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
                                <path d="M13 6h6M16 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                <circle cx="12" cy="18" r="1" fill="currentColor" />
                                <circle cx="16" cy="18" r="1" fill="currentColor" />
                                <circle cx="20" cy="18" r="1" fill="currentColor" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-foreground tracking-tight">AI Email Agents</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed tracking-normal">
                            Build intelligent email responders and customer service bots. Auto-reply with context-aware AI responses.
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 tracking-normal">
                            <li>• Conversation threading</li>
                            <li>• AI-powered replies</li>
                            <li>• Email classification</li>
                            <li>• Custom response logic</li>
                        </ul>
                    </div>
                </div>

            </div>
        </section>
    )
}
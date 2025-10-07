"use client"

import { Badge } from "@/components/ui/badge"

export function UseCases() {
    return (
        <section className="overflow-hidden py-16 max-md:py-12 items-center justify-center px-4 flex gap-12 relative flex-col w-full">
            {/* Header */}
            <div className="w-full flex justify-start items-center">
                <div className="flex flex-col items-start gap-3 sm:gap-4">
                    <Badge className="gap-2">
                        <span className="inline-flex items-center justify-center">
                            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 2L6 6L11 2" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="1" y="2" width="10" height="6" stroke="currentColor" strokeWidth="1" fill="none" rx="1" />
                            </svg>
                        </span>
                        <span className="text-sm">Use Cases</span>
                    </Badge>
                    <h2 className="text-left text-foreground text-2xl md:text-3xl lg:text-5xl font-semibold leading-tight tracking-tight">
                        Email API Use Cases
                    </h2>
                    <p className="text-left text-muted-foreground text-sm sm:text-base leading-6 sm:leading-7 tracking-normal">
                        From SaaS applications to e-commerce platforms, our email API powers diverse use cases.
                    </p>
                </div>
            </div>

            {/* Use Cases Grid */}
            <div className="w-full flex justify-center items-start">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-border divide-y sm:divide-y-0 sm:divide-x divide-border rounded-l-2xl rounded-r-2xl overflow-hidden">
                    {/* SaaS Applications */}
                    <div className="flex flex-col items-start text-left gap-4 md:p-6 p-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/30 flex items-center justify-center">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="4" y="6" width="24" height="16" rx="2" stroke="#2563eb" strokeWidth="2" fill="none" />
                                <path d="M4 10h24M8 14h8M8 18h12" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
                                <circle cx="22" cy="16" r="2" fill="#2563eb" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">SaaS Applications</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed tracking-normal">
                            User onboarding, notifications, and support email automation for software platforms.
                        </p>
                    </div>

                    {/* E-commerce */}
                    <div className="flex flex-col items-start text-left gap-4 md:p-6 p-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/30 flex items-center justify-center">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 8l2 12h16l2-12H6z" stroke="#16a34a" strokeWidth="2" fill="none" />
                                <path d="M6 8H4M26 8h2M10 12v4M14 12v4M18 12v4M22 12v4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" />
                                <circle cx="12" cy="26" r="2" stroke="#16a34a" strokeWidth="2" fill="none" />
                                <circle cx="20" cy="26" r="2" stroke="#16a34a" strokeWidth="2" fill="none" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">E-commerce</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed tracking-normal">
                            Order confirmations, shipping updates, and customer service email workflows.
                        </p>
                    </div>

                    {/* Customer Support */}
                    <div className="flex flex-col items-start text-left gap-4 md:p-6 p-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/30 flex items-center justify-center">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="16" cy="12" r="4" stroke="#7c3aed" strokeWidth="2" fill="none" />
                                <path d="M8 28c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#7c3aed" strokeWidth="2" fill="none" />
                                <path d="M20 6c2 0 4 1 4 3s-2 3-4 3M24 20c2 0 4 1 4 3" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" />
                                <circle cx="22" cy="8" r="1" fill="#7c3aed" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Customer Support</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed tracking-normal">
                            AI-powered support agents that handle common queries and route complex issues.
                        </p>
                    </div>

                    {/* Marketing Automation */}
                    <div className="flex flex-col items-start text-left gap-4 md:p-6 p-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/30 flex items-center justify-center">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 4v24M4 16h24" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" />
                                <circle cx="16" cy="16" r="6" stroke="#ea580c" strokeWidth="2" fill="none" />
                                <path d="M22 10l4-4M10 22l-4 4M22 22l4 4M10 10l-4-4" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round" />
                                <circle cx="16" cy="16" r="2" fill="#ea580c" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Marketing Automation</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed tracking-normal">
                            Drip campaigns, newsletter management, and behavioral email triggers.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
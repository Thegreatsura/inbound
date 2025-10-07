"use client"

import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/ui/code-block"

export function DeveloperExperience() {
    return (
        <section className="overflow-hidden py-16 max-md:py-12 items-center justify-center px-4 flex gap-12 relative flex-col w-full">
            {/* Header */}
            <div className="w-full flex justify-start items-center">
                <div className="flex flex-col items-start gap-3 sm:gap-4">
                    <Badge className="gap-2">
                        <span className="inline-flex items-center justify-center">
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                                <rect x="1" y="2" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
                                <path d="M3 4h6M3 6h4M3 8h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                                <circle cx="9" cy="6" r="1" fill="currentColor" />
                            </svg>
                        </span>
                        <span className="text-sm">Developer Experience</span>
                    </Badge>
                    <h2 className="text-left text-foreground text-2xl md:text-3xl lg:text-5xl font-semibold leading-tight tracking-tight">
                        Built for Developers
                    </h2>
                    <p className="text-left text-muted-foreground text-sm sm:text-base leading-6 sm:leading-7 tracking-normal">
                        TypeScript-first SDK, comprehensive documentation, and webhook-based architecture for modern applications.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="w-full flex justify-center items-start">
                <div className="flex-1 grid md:grid-cols-2 gap-8 lg:gap-12 items-center border border-border rounded-2xl overflow-hidden">
                    {/* Left: bullets */}
                    <div className="md:p-6 p-4 h-full flex flex-col justify-between">
                        <h3 className="text-2xl font-semibold text-foreground mb-4">TypeScript SDK</h3>
                        <p className="text-muted-foreground tracking-normal leading-relaxed mb-6">
                            Full type safety with IntelliSense support. Our SDK provides complete TypeScript definitions for all email operations, webhook payloads, and API responses.
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-foreground rounded-full mt-2" />
                                <div>
                                    <h4 className="font-medium text-foreground">Type-Safe Webhooks</h4>
                                    <p className="text-sm text-muted-foreground tracking-normal">Fully typed webhook payloads for email events</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-foreground rounded-full mt-2" />
                                <div>
                                    <h4 className="font-medium text-foreground">Auto-Complete Support</h4>
                                    <p className="text-sm text-muted-foreground tracking-normal">IntelliSense for all API methods and parameters</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-foreground rounded-full mt-2" />
                                <div>
                                    <h4 className="font-medium text-foreground">Error Handling</h4>
                                    <p className="text-sm text-muted-foreground tracking-normal">Comprehensive error types and status codes</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: code */}
                    <div className="md:p-6 p-4">
                        <div className="bg-background border border-border rounded-lg overflow-hidden">
                            <div className="py-1.5 px-4 bg-muted/50 border-b border-border font-mono text-xs flex items-center gap-2 text-muted-foreground">
                                <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
									<svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                                        <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" fill="white" />
                                    </svg>
                                </div>
                                <span>email-handler.ts</span>
                            </div>
                            <div className="overflow-x-auto w-full">
                                <div className="">
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
                                    language="javascript"
                                    copy={false}
                                    wrap={true}
                                    className="rounded-none border-0 m-0 text-xs tracking-normal"
                                />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}



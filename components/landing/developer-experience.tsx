"use client"

import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/ui/code-block"
import Code2 from "@/components/icons/code-2"
import CirclePlay from "@/components/icons/circle-play"

export function DeveloperExperience() {
    return (
        <section className="overflow-hidden py-16 max-md:py-12 items-center justify-center px-4 flex gap-12 relative flex-col w-full">
            {/* Header */}
            <div className="w-full flex justify-start items-center">
                <div className="flex flex-col items-start gap-3 sm:gap-4">
                    <Badge className="gap-2">
                        <span className="inline-flex items-center justify-center text-[#7C3AED]">
                            <Code2 width={12} height={12} />
                        </span>
                        <span className="text-sm">Developer Experience</span>
                    </Badge>
                    <h2 className="text-left text-foreground text-2xl md:text-3xl lg:text-5xl font-semibold leading-tight tracking-tight">
                        Built for Developers
                    </h2>
                    <p className="text-left text-muted-foreground text-sm sm:text-base leading-6 sm:leading-7 tracking-normal">
                        A simple, consistent REST API with typed webhooks. Clear errors. Predictable resources.
                    </p>
                    <a 
                        href="https://youtu.be/MOi19cSQdRI" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-2"
                    >
                        <CirclePlay width={16} height={16} />
                        Watch setup tutorial
                    </a>
                </div>
            </div>

            {/* Content */}
            <div className="w-full flex justify-center items-start">
                <div className="flex-1 grid md:grid-cols-2 gap-8 lg:gap-12 items-center border border-border border-dashed overflow-hidden">
                    {/* Left: bullets */}
                    <div className="md:p-6 p-4 h-full flex flex-col justify-between">
                        <h3 className="text-2xl font-semibold text-foreground mb-4">Unified Email API</h3>
                        <p className="text-muted-foreground tracking-normal leading-relaxed mb-6">
                            Send, receive, and reply via REST. Webhooks deliver structured events for replies and delivery.
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-foreground rounded-full mt-2" />
                                <div>
                                    <h4 className="font-medium text-foreground">Consistent REST resources</h4>
                                    <p className="text-sm text-muted-foreground tracking-normal">Emails, threads, attachments—predictable endpoints</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-foreground rounded-full mt-2" />
                                <div>
                                    <h4 className="font-medium text-foreground">Idempotent & clear errors</h4>
                                    <p className="text-sm text-muted-foreground tracking-normal">Safe retries with explicit status codes</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-foreground rounded-full mt-2" />
                                <div>
                                    <h4 className="font-medium text-foreground">Typed webhooks</h4>
                                    <p className="text-sm text-muted-foreground tracking-normal">Structured payloads for replies and delivery</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: code */}
                    <div className="md:p-6 p-4">
                        <div className="bg-background border border-border border-dashed overflow-hidden">
                            <div className="py-1.5 px-4 bg-muted/50 border-b border-border font-mono text-xs flex items-center gap-2 text-muted-foreground">
                                <span className="inline-flex items-center justify-center text-[#7C3AED]"><Code2 width={12} height={12} /></span>
                                <span>POST /v2/emails</span>
                            </div>
                            <div className="overflow-x-auto w-full">
                                <div className="">
                                <CodeBlock
                                    code={`POST https://api.inbound.email/v2/emails
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "from": "agent@inbnd.dev",
  "to": "you@example.com",
  "subject": "Welcome to Inbound",
  "html": "<p>Thanks for signing up!</p>"
}`}
                                    language="bash"
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



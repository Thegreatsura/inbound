"use client"

import { Badge } from "@/components/ui/badge"
import Envelope2 from "@/components/icons/envelope-2"
import PaperPlane2 from "@/components/icons/paper-plane-2"
import InboxArrowDown from "@/components/icons/inbox-arrow-down"
import Microchip from "@/components/icons/microchip"

export function Solution() {
    return (
        <section className="overflow-hidden py-16 max-md:py-12  items-center justify-center px-4 flex gap-12 relative flex-col w-full">
            {/* Header */}
            <div className="w-full flex justify-start items-center">
                <div className="flex flex-col items-start gap-3 sm:gap-4">
                    <Badge className="gap-2" >
						<span className="inline-flex items-center justify-center text-[#7C3AED]">
							<Envelope2 width="12" height="12" />
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
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 border border-border border-dashed divide-y divide-dashed md:divide-y-0 md:divide-x divide-border overflow-hidden">
                    {/* Send Transactional Emails */}
                    <div className="flex flex-col gap-4 min-h-max md:p-6 p-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#7C3AED]/10 to-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED]">
                            <PaperPlane2 width="20" height="20" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground tracking-tight">Transactional Email Sending</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed tracking-normal">
                            Deliver confirmations, notifications, and alerts with a reliable sending API. Fully compatible with popular email services. Also called outbound email sending, <a href="https://x.com/itswilsonhou/status/1981841420534362281" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">wilson</a>.
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
                        <div className="w-16 h-16 bg-gradient-to-br from-[#7C3AED]/10 to-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED]">
                            <InboxArrowDown width="20" height="20" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground tracking-tight">Threaded Email Reception</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed tracking-normal">
                            Receive inbound email via webhooks and automatically organize conversations into manageable threads. Access structured data including HTML, text, attachments, and headers.
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
                        <div className="w-16 h-16 bg-gradient-to-br from-[#7C3AED]/10 to-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED]">
                            <Microchip width="20" height="20" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground tracking-tight">AI Agent Integration for Email</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed tracking-normal">
                            Integrate AI agents to classify, summarize, and reply using full thread context for precise, automated responses.
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
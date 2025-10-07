"use client"

import { Button } from "@/components/ui/button"

export function CTA() {
    return (
        <section className="w-full px-4 py-16 max-md:py-12">
            <div className="mx-auto">
                <div className="text-center flex flex-col items-center gap-4 border border-border bg-card rounded-2xl px-6 sm:px-8 h-[330px] justify-center shadow-sm">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight">
                        Ready to Build with Email?
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground tracking-normal">
                        Join developers who've simplified their email infrastructure with Inbound.
                    </p>
                    <div className="flex items-center gap-3 sm:gap-4 mt-2">
                        <Button asChild className="h-10 px-4">
                            <a href="/login">Start Free</a>
                        </Button>
                        <Button asChild variant="secondary" className="h-10 px-4">
                            <a href="/docs">View Documentation</a>
                        </Button>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 tracking-normal">
                        Free tier · 1,000 emails/month · No credit card required
                    </p>
                </div>
            </div>
        </section>
    )
}



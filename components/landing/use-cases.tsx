"use client"

import { Badge } from "@/components/ui/badge"
import StackPerspective2 from "@/components/icons/stack-perspective-2"
import Grid2 from "@/components/icons/grid-2"
import Users6 from "@/components/icons/users-6"
import ChartTrendUp from "@/components/icons/chart-trend-up"
import CartShopping from "../icons/cart-shopping"

export function UseCases() {
    return (
        <section className="overflow-hidden py-16 max-md:py-12 items-center justify-center px-4 flex gap-12 relative flex-col w-full">
            {/* Header */}
            <div className="w-full flex justify-start items-center">
                <div className="flex flex-col items-start gap-3 sm:gap-4">
                    <Badge className="gap-2">
                        <span className="inline-flex items-center justify-center text-[#7C3AED]"><StackPerspective2 width={12} height={12} /></span>
                        <span className="text-sm">Use Cases</span>
                    </Badge>
                    <h2 className="text-left text-foreground text-2xl md:text-3xl lg:text-5xl font-semibold leading-tight tracking-tight">
                        Email API use cases
                    </h2>
                    <p className="text-left text-muted-foreground text-sm sm:text-base leading-6 sm:leading-7 tracking-normal">
                        Power onboarding, lifecycle messaging, support, and growth across your product.
                    </p>
                </div>
            </div>

            {/* Use Cases Grid */}
            <div className="w-full flex justify-center items-start">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-border border-dashed divide-y divide-dashed sm:divide-y-0 sm:divide-x divide-border overflow-hidden">
                    {/* SaaS Applications */}
                    <div className="flex flex-col items-start text-left gap-4 md:p-6 p-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#7C3AED]/10 to-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED]">
                            <Grid2 width={32} height={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">SaaS Applications</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed tracking-normal">
                            Onboarding, notifications, and support across your app lifecycle.
                        </p>
                    </div>

                    {/* E-commerce */}
                    <div className="flex flex-col items-start text-left gap-4 md:p-6 p-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#7C3AED]/10 to-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED]">
                            <CartShopping width={32} height={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">E-commerce</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed tracking-normal">
                            Orders, shipping updates, and customer support automation.
                        </p>
                    </div>

                    {/* Customer Support */}
                    <div className="flex flex-col items-start text-left gap-4 md:p-6 p-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#7C3AED]/10 to-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED]">
                            <Users6 width={32} height={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Customer Support</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed tracking-normal">
                            AI agents to resolve common issues and route complex tickets.
                        </p>
                    </div>

                    {/* Marketing Automation */}
                    <div className="flex flex-col items-start text-left gap-4 md:p-6 p-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#7C3AED]/10 to-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED]">
                            <ChartTrendUp width={32} height={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Marketing Automation</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed tracking-normal">
                            Drip campaigns, newsletters, and behavior-based triggers.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
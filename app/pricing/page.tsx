"use client"

import Link from 'next/link'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { PricingTable } from "@/components/autumn/pricing-table-format"
import { SiteHeader } from "@/components/site-header"
import InboundIcon from '@/components/icons/inbound'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground relative">

      <SiteHeader />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-5xl mb-6 leading-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-16 leading-relaxed">
          Choose the plan that fits your needs. Start free, upgrade when you're ready.
          <br />
          All plans include our core email platform features.
        </p>

        {/* Pricing Table */}
        <div className="mt-16">
          <PricingTable />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-card py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl text-center mb-4 text-foreground">Frequently asked questions</h2>
          <p className="text-muted-foreground text-center mb-12">
            Got questions? We've got answers.
          </p>
          
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">What counts as an email?</h3>
              <p className="text-muted-foreground">
                Both sent and received emails count toward your monthly limit. Each individual recipient counts as one email (so sending to 3 people = 3 emails).
              </p>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">Can I change plans anytime?</h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and we'll prorate any billing differences.
              </p>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">What happens if I exceed my limit?</h3>
              <p className="text-muted-foreground">
                We'll notify you when you're approaching your limit. If you exceed it, we'll pause email sending until you upgrade or the next billing cycle starts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl mb-4 text-foreground">Ready to get started?</h2>
        <p className="text-lg text-muted-foreground mb-12">
          Join thousands of developers who trust Inbound for their email infrastructure.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            variant="primary"
            className="font-medium px-8 py-3"
            asChild
          >
            <Link href="/login">start free</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="font-medium px-8 py-3"
            asChild
          >
            <Link href="mailto:support@inbound.new">contact sales</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-sidebar py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <InboundIcon width={32} height={32} />
              <span className="text-xl font-semibold text-foreground">inbound</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <Link href="https://docs.inbound.new" className="hover:text-foreground transition-colors">docs</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">terms</Link>
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

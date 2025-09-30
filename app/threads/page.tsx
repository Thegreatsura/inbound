"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import InboundIcon from "@/components/icons/inbound";
import { submitThreadsWaitlist } from "@/app/actions/primary";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export default function ThreadsWaitlistPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await submitThreadsWaitlist({
        name: name.trim(),
        email: email.trim()
      });

      if (result.success) {
        setIsSubmitted(true);
        toast.success("you're on the list!");
      } else {
        toast.error(result.error || "something went wrong. please try again.");
      }
    } catch (error) {
      console.error("Error submitting waitlist:", error);
      toast.error("something went wrong. please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const useCases = [
    {
      title: "get simple to read threads for a mail or grouping",
      description: "conversations organized automatically with all context in one place"
    },
    {
      title: "easily reply to the latest message in a thread",
      description: "no more hunting for the right email to respond to"
    },
    {
      title: "don't worry about mail management",
      description: "we handle threading, grouping, and organization for you"
    }
  ];

  return (
    <div className="min-h-screen relative">
      <SiteHeader />
      <Toaster />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
            <span className="text-sm font-medium text-purple-400">coming soon</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-foreground leading-[1.05] mb-6">
            inbound threads
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            the simplest way to manage email conversations. thread-first email management built for modern teams.
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left Column - Use Cases */}
          <div className="space-y-8">
            <h2 className="text-2xl font-semibold mb-8">what you can do</h2>
            
            {useCases.map((useCase, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-1">
                      {useCase.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {useCase.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column - Signup Form */}
          <div className="lg:sticky lg:top-24">
            <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
              {!isSubmitted ? (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-semibold mb-2">join the waitlist</h2>
                    <p className="text-sm text-muted-foreground">
                      be the first to know when we launch
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">name</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "joining..." : "join waitlist"}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-purple-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">you&apos;re on the list!</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    we&apos;ll notify you at <span className="font-medium text-foreground">{email}</span> when threads launches.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsSubmitted(false);
                      setName("");
                      setEmail("");
                    }}
                  >
                    add another
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-sidebar py-12 relative z-10 mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <InboundIcon width={32} height={32} />
              <span className="text-xl font-semibold text-foreground font-outfit">inbound</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <Link href="https://docs.inbound.new" className="hover:text-foreground transition-colors">docs</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">terms</Link>
              <a href="mailto:support@inbound.new" className="hover:text-foreground transition-colors">support</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} inbound (by exon). the all-in-one email toolkit for developers.
          </div>
        </div>
      </footer>
    </div>
  );
}
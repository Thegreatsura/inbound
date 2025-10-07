"use client"

import Link from "next/link"
import InboundIcon from "../icons/inbound"


export function Footer() {
    return (
        <footer className="w-full  px-4 py-16 max-md:py-12 ">
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <a href="/" className="flex items-center gap-2 min-w-0">
                        <Link href="/" className="flex items-center gap-2">
                            <InboundIcon width={32} height={32} />
                            <span className="text-2xl font-outfit font-semibold tracking-tight">
                                inbound
                            </span>
                        </Link>
                    </a>

                    <nav className="flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
                        <Link className="opacity-70 hover:opacity-100 font-medium tracking-normal" href="/docs">Docs</Link>
                        <Link className="opacity-70 hover:opacity-100 font-medium tracking-normal" href="/privacy">Privacy</Link>
                        <Link className="opacity-70 hover:opacity-100 font-medium tracking-normal" href="/terms">Terms</Link>
                        <Link className="opacity-70 hover:opacity-100 font-medium tracking-normal" href="/support">Support</Link>
                        <Link className="opacity-70 hover:opacity-100 font-medium tracking-normal" href="/links">Links</Link>
                    </nav>
                </div>

                <div className="text-sm text-muted-foreground tracking-normal">
                    © {new Date().getFullYear()} inbound (by exon). The all-in-one email toolkit for developers.
                </div>
            </div>
        </footer>
    )
}



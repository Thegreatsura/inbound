"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/auth-client";
import InboundIcon from "./icons/inbound";
import Menu from "./icons/menu";
import CircleXmark from "./icons/circle-xmark";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setTheme(saved === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const isActive = (href: string) =>
    pathname === href || (href === "/blog" && pathname.startsWith("/blog"));

  return (
    <>
      <header className="border-b border-border bg-sidebar/90 backdrop-blur-sm sticky top-0 z-[100]">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <InboundIcon width={32} height={32} />
            <span className="text-2xl font-outfit font-semibold tracking-tight">
              inbound
            </span>
          </Link>
          
          <div className="flex items-center">
            <nav className="hidden md:flex items-center gap-6 text-sm">
              {["features", "/examples", "/pricing", "/docs", "/blog"].map(
                (href) => (
                  <Link
                    key={href}
                    href={href}
                    className={`opacity-70 hover:opacity-100 ${
                      isActive(href) ? "opacity-100 font-medium" : ""
                    }`}
                  >
                    {href
                      .replace("/", "")
                      .replace("#", "")
                      .replace(/^\w/, (c) => c.toUpperCase())}
                  </Link>
                )
              )}
              {session?.user ? (
                <Button variant="primary" asChild>
                  <Link href="/logs">
                    hey {session.user.name.toLowerCase().split(" ")[0]} 👋
                  </Link>
                </Button>
              ) : (
                <Button variant="primary" asChild>
                  <Link href="/login">Get Started</Link>
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  aria-hidden="true"
                >
                  <g fill="currentColor">
                    <circle cx="9" cy="9" r="7.25" opacity="0.3" />
                    <path d="M9 6v6c1.66 0 3-1.34 3-3s-1.34-3-3-3Z" />
                    <path d="M9 12c-1.66 0-3-1.34-3-3s1.34-3 3-3V1.75A7.25 7.25 0 1 0 9 16.25V12Z" />
                    <circle
                      cx="9"
                      cy="9"
                      r="7.25"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                    />
                  </g>
                </svg>
              </Button>
            </nav>
            
            <Button
              variant="secondary"
              size="icon"
              className="md:hidden"
              onClick={toggleMobileMenu}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <CircleXmark width={18} height={18} />
              ) : (
                <Menu width={18} height={18} />
              )}
            </Button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[9999] md:hidden">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={toggleMobileMenu}
              aria-hidden="true"
            />
            
            <motion.div 
              className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-sidebar border-l border-border shadow-xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            >
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-6 border-b border-border">
                <Link href="/" className="flex items-center gap-2">
            <InboundIcon width={32} height={32} />
            <span className="text-2xl font-outfit font-semibold tracking-tight">
              inbound
            </span>
          </Link>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={toggleMobileMenu}
                    aria-label="Close menu"
                  >
                    <CircleXmark width={18} height={18} />
                  </Button>
                </div>
                
                <nav className="flex-1 p-6">
                  <div className="flex flex-col gap-6">
                    {["features", "/examples", "/pricing", "/docs", "/blog"].map(
                      (href) => (
                        <Link
                          key={href}
                          href={href}
                          className={`text-lg py-3 px-4 rounded-lg transition-colors ${
                            isActive(href) 
                              ? "bg-primary/10 text-primary font-medium" 
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {href
                            .replace("/", "")
                            .replace("#", "")
                            .replace(/^\w/, (c) => c.toUpperCase())}
                        </Link>
                      )
                    )}
                  </div>
                </nav>
                
                <div className="p-6 border-t border-border space-y-4">
                  {session?.user ? (
                    <Button variant="primary" asChild className="w-full">
                      <Link href="/logs" onClick={() => setIsMobileMenuOpen(false)}>
                        hey {session.user.name.toLowerCase().split(" ")[0]} 👋
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="primary" asChild className="w-full">
                      <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                        Get Started
                      </Link>
                    </Button>
                  )}
                  
                  <Button
                    variant="secondary"
                    onClick={toggleTheme}
                    className="w-full"
                    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      aria-hidden="true"
                      className="mr-2"
                    >
                      <g fill="currentColor">
                        <circle cx="9" cy="9" r="7.25" opacity="0.3" />
                        <path d="M9 6v6c1.66 0 3-1.34 3-3s-1.34-3-3-3Z" />
                        <path d="M9 12c-1.66 0-3-1.34-3-3s1.34-3 3-3V1.75A7.25 7.25 0 1 0 9 16.25V12Z" />
                        <circle
                          cx="9"
                          cy="9"
                          r="7.25"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          fill="none"
                        />
                      </g>
                    </svg>
                    Switch to {theme === "dark" ? "light" : "dark"} mode
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

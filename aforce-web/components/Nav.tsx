"use client";

import { useEffect, useState } from "react";
import Monogram from "./Monogram";

const LINKS = [
  { href: "#why", label: "Why" },
  { href: "#science", label: "Science" },
  { href: "#ritual", label: "Ritual" },
  { href: "#products", label: "Products" },
  { href: "#membership", label: "OS" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled
          ? "border-b border-white/[0.06] bg-canvas/70 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10">
        <a href="#hero" className="flex items-center gap-3" aria-label="AForce home">
          <span className="font-display text-sm tracking-[0.2em] text-bone">
            AFORCE
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/55 transition-colors hover:text-bone"
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          href="#membership"
          className="rounded-full border border-white/[0.14] px-5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-bone transition-colors hover:border-signal hover:text-signal"
        >
          Join
        </a>
      </nav>
    </header>
  );
}

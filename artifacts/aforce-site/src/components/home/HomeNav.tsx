import { useEffect, useState } from 'react';
import { Link } from 'wouter';

const LINKS = [
  { href: '#protocol', label: 'Protocol' },
  { href: '#product', label: 'Product' },
  { href: '#operators', label: 'Operators' },
  { href: '#science', label: 'Science' },
  { href: '#os', label: 'OS' },
];

export function HomeNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-ink/80 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 h-16 lg:h-[72px] flex items-center justify-between">
        <a href="#hero" className="flex items-center gap-3 group">
          <span className="w-1.5 h-1.5 rounded-full bg-signal pulse-dot" />
          <span className="font-display text-base font-extrabold tracking-[0.32em] text-white">
            AFORCE
          </span>
        </a>

        <div className="hidden md:flex items-center gap-9 font-label text-[10px] uppercase tracking-[0.3em] text-white/55">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hover:text-white transition-colors duration-300"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/products"
            className="hover:text-white transition-colors duration-300"
          >
            Shop
          </Link>
        </div>

        <a
          href="#commerce"
          className="font-label text-[10px] uppercase tracking-[0.28em] text-white border border-white/20 hover:border-signal hover:text-signal px-4 lg:px-5 py-2.5 rounded-full transition-all duration-500"
        >
          Start Protocol
        </a>
      </div>
    </nav>
  );
}

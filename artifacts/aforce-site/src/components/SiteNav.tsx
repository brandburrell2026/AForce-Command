import { Link } from 'wouter';

const LINKS = [
  { href: '/manifesto', label: 'Manifesto' },
  { href: '/science', label: 'Science' },
  { href: '/os', label: 'OS' },
  { href: '/investors', label: 'Investors' },
  { href: '/founders', label: 'Founders' },
  { href: '/contact', label: 'Contact' },
];

export function SiteNav({ current }: { current: string }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
          <span className="text-sm font-bold tracking-[0.3em] uppercase">AForce</span>
        </Link>
        <div className="hidden lg:flex items-center gap-8 text-[10px] uppercase tracking-[0.25em] text-white/55">
          {LINKS.map((l) =>
            l.href === current ? (
              <span key={l.href} className="text-white">{l.label}</span>
            ) : (
              <Link key={l.href} href={l.href} className="hover:text-white transition-colors">
                {l.label}
              </Link>
            )
          )}
        </div>
        <Link href="/" className="text-[11px] uppercase tracking-[0.3em] text-white/55 hover:text-white transition-colors">
          ← Back
        </Link>
      </div>
    </nav>
  );
}

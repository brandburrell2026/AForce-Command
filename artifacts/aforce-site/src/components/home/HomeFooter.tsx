import { Link } from 'wouter';
import { EarlyAccessCapture } from '@/components/EarlyAccessCapture';

const AFORCE_OS_URL =
  (import.meta.env.VITE_AFORCE_OS_URL as string | undefined) ?? '/';

const NAV = [
  { label: 'Shop', to: '/products' },
  { label: 'Manifesto', to: '/manifesto' },
  { label: 'Science', to: '/science' },
  { label: 'OS', to: '/os' },
  { label: 'Investors', to: '/investors' },
  { label: 'Founders', to: '/founders' },
  { label: 'Contact', to: '/contact' },
];

export function HomeFooter() {
  return (
    <footer className="relative w-full bg-ink text-white pt-24 pb-12 px-6 sm:px-10 lg:px-20 border-t border-white/[0.06]">
      <div className="max-w-[1500px] mx-auto">
        <div className="flex flex-col lg:flex-row justify-between gap-16 mb-20">
          <div className="max-w-sm flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-signal pulse-dot" />
              <span className="font-display text-base font-extrabold tracking-[0.32em]">
                AFORCE
              </span>
            </div>
            <p className="text-white/45 text-sm leading-relaxed">
              The performance system for the minute before execution. Controlled
              focus — not stimulation.
            </p>
            <EarlyAccessCapture source="footer_cta" buttonText="Join" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-5 font-label text-[10px] uppercase tracking-[0.28em]">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.to}
                className="text-white/50 hover:text-white transition-colors duration-300"
              >
                {n.label}
              </Link>
            ))}
            <a
              href={AFORCE_OS_URL}
              className="text-white/50 hover:text-white transition-colors duration-300"
            >
              AForce OS
            </a>
          </div>
        </div>

        <div className="pt-8 border-t border-white/[0.06] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 font-label text-[9px] uppercase tracking-[0.3em] text-white/30">
          <span>© AForce — Performance is non-negotiable.</span>
          <span>Pause · Hydrate · Lock In · Perform</span>
        </div>
      </div>
    </footer>
  );
}

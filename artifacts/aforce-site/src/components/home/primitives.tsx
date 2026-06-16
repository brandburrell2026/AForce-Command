import { motion, useReducedMotion } from 'framer-motion';
import { type ReactNode } from 'react';
import { Link } from 'wouter';

/** Slow, confident, intentional easing used across the whole homepage. */
export const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = 'dark' | 'light';

/** Section label: a signal-red hairline + Space Mono tracked caption. */
export function Eyebrow({
  index,
  children,
  tone = 'dark',
  center = false,
}: {
  index?: string;
  children: ReactNode;
  tone?: Tone;
  center?: boolean;
}) {
  const text = tone === 'dark' ? 'text-white/55' : 'text-ink/60';
  return (
    <div className={`flex items-center gap-4 ${center ? 'justify-center' : ''}`}>
      <span className="h-px w-10 bg-signal" />
      <span className={`font-label text-[10px] uppercase tracking-[0.4em] ${text}`}>
        {index && <span className="text-signal">{index}</span>}
        {index && '  '}
        {children}
      </span>
      {center && <span className="h-px w-10 bg-signal" />}
    </div>
  );
}

/** Scroll-reveal wrapper — fades + lifts content into place on enter. */
export function FadeIn({
  children,
  delay = 0,
  y = 26,
  className = '',
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'span' | 'li';
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={reduce ? undefined : { duration: 1.1, ease: EASE, delay }}
    >
      {children}
    </MotionTag>
  );
}

function isHashOrExternal(href: string) {
  return (
    href.startsWith('#') ||
    href.startsWith('http') ||
    href.startsWith('mailto') ||
    href.startsWith('tel')
  );
}

/** Primary / outline CTA that adapts to dark or light surfaces. */
export function CtaLink({
  to,
  children,
  variant = 'solid',
  tone = 'dark',
  className = '',
}: {
  to: string;
  children: ReactNode;
  variant?: 'solid' | 'outline';
  tone?: Tone;
  className?: string;
}) {
  const base =
    'group inline-flex items-center justify-center gap-3 px-7 py-3.5 text-[11px] font-label uppercase tracking-[0.28em] transition-all duration-500 rounded-full whitespace-nowrap';

  let look = '';
  if (variant === 'solid') {
    look =
      tone === 'dark'
        ? 'bg-white text-ink hover:bg-signal hover:text-white'
        : 'bg-ink text-white hover:bg-signal';
  } else {
    look =
      tone === 'dark'
        ? 'border border-white/25 text-white hover:border-white/70'
        : 'border border-ink/25 text-ink hover:border-ink/70';
  }

  const content = (
    <>
      {children}
      <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">
        →
      </span>
    </>
  );

  if (isHashOrExternal(to)) {
    return (
      <a href={to} className={`${base} ${look} ${className}`}>
        {content}
      </a>
    );
  }
  return (
    <Link href={to} className={`${base} ${look} ${className}`}>
      {content}
    </Link>
  );
}

/** Shared section shell — handles dark/light surface + vertical rhythm. */
export function Section({
  id,
  tone = 'dark',
  className = '',
  children,
}: {
  id?: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  const surface =
    tone === 'dark' ? 'bg-ink text-white' : 'bg-paper text-ink';
  return (
    <section
      id={id}
      className={`relative w-full overflow-hidden px-6 sm:px-10 lg:px-20 py-28 lg:py-40 ${surface} ${className}`}
    >
      {children}
    </section>
  );
}

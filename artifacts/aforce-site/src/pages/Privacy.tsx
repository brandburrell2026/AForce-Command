import { useEffect } from 'react';
import { Link } from 'wouter';

const CINEMATIC_BLACK = '#0D0D0D';
const SIGNAL_RED = '#C1281B';
const SECONDARY = 'rgba(255,255,255,0.55)';

const FONT_DISPLAY = '"Archivo Black", system-ui, sans-serif';
const FONT_MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace';
const FONT_BODY = '"Inter", system-ui, -apple-system, sans-serif';

const CANONICAL_URL = 'https://www.drinkaforce.com/privacy';
const CONTACT_EMAIL = 'privacy@drinkaforce.com';
const WEBSITE_URL = 'https://www.drinkaforce.com';

const EFFECTIVE_DATE = 'April 26, 2026';
const LAST_UPDATED = 'June 24, 2026';

/** Shared inline style for in-copy links (Signal Red, used sparingly). */
const linkStyle: React.CSSProperties = {
  color: SIGNAL_RED,
  textDecoration: 'none',
  borderBottom: `1px solid ${SIGNAL_RED}40`,
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        letterSpacing: '0.32em',
        textTransform: 'uppercase',
        color: SECONDARY,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function Section({
  index,
  heading,
  children,
}: {
  index: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 40, marginTop: 40 }}>
      <Eyebrow>{index}</Eyebrow>
      <h2
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 'clamp(1.25rem, 3.5vw, 1.6rem)',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          color: SIGNAL_RED,
          margin: '0 0 18px',
        }}
      >
        {heading}
      </h2>
      <div style={{ color: '#FFFFFF', fontSize: 'clamp(0.95rem, 2.4vw, 1.05rem)', lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  );
}

/** A muted list used inside sections (e.g. data categories, third parties). */
function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: 12 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span
            aria-hidden
            style={{
              flex: '0 0 auto',
              width: 6,
              height: 6,
              borderRadius: 9999,
              background: SIGNAL_RED,
              marginTop: 11,
            }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Privacy() {
  // Public legal page: set the document title and a canonical link to the
  // www apex so the policy is unambiguously indexed at the canonical URL.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Privacy Policy — AForce';

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    let created = false;
    let prevHref = '';
    if (link) {
      prevHref = link.href;
    } else {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
      created = true;
    }
    link.href = CANONICAL_URL;

    return () => {
      document.title = prevTitle;
      if (created) {
        link?.remove();
      } else if (link) {
        link.href = prevHref;
      }
    };
  }, []);

  return (
    <div
      style={{
        background: CINEMATIC_BLACK,
        minHeight: '100vh',
        color: '#FFFFFF',
        fontFamily: FONT_BODY,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Minimal top nav — consistent with the other AForce site pages */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px)',
          background: 'rgba(13,13,13,0.7)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            padding: '0 24px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <span style={{ width: 6, height: 6, borderRadius: 9999, background: SIGNAL_RED }} />
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
              }}
            >
              AForce
            </span>
          </Link>
          <Link
            href="/"
            style={{
              color: SECONDARY,
              fontSize: 11,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            ← Back
          </Link>
        </div>
      </nav>

      <main
        style={{
          maxWidth: 780,
          margin: '0 auto',
          padding: 'clamp(48px, 9vw, 96px) 24px clamp(80px, 12vw, 140px)',
        }}
      >
        {/* ── Header ── */}
        <header>
          <Eyebrow>Legal</Eyebrow>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 'clamp(2.4rem, 9vw, 4.25rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              margin: 0,
              color: '#FFFFFF',
            }}
          >
            Privacy Policy
          </h1>
          <div style={{ width: 72, height: 3, background: SIGNAL_RED, margin: '24px 0 28px' }} />
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              letterSpacing: '0.06em',
              color: SECONDARY,
              display: 'grid',
              gap: 6,
            }}
          >
            <div>Effective Date: {EFFECTIVE_DATE}</div>
            <div>Last Updated: {LAST_UPDATED}</div>
          </div>
          <p
            style={{
              marginTop: 28,
              fontSize: 'clamp(1rem, 2.6vw, 1.15rem)',
              lineHeight: 1.7,
              color: '#FFFFFF',
              maxWidth: 620,
            }}
          >
            We collect what we need to make the product work, store it carefully, and give you control.
            This policy explains what AForce OS collects, how we use it, and the rights you have over your
            information.
          </p>
        </header>

        {/* ── 01 — What we collect ── */}
        <Section index="01" heading="What we collect">
          <p>
            We collect only what we need to run AForce OS and personalize your experience:
          </p>
          <List
            items={[
              <>
                <strong style={{ color: '#FFFFFF' }}>Health &amp; fitness data</strong> — hydration and
                recovery events you log, and optional signals from health platforms you connect (for example
                Apple Health or Oura), such as heart rate, heart-rate variability, sleep, and workouts.
              </>,
              <>
                <strong style={{ color: '#FFFFFF' }}>Email</strong> — the email address you use to create and
                sign in to your account.
              </>,
              <>
                <strong style={{ color: '#FFFFFF' }}>User ID</strong> — an authentication identifier created
                when you sign in (handled by Clerk), plus profile signals you choose to enter such as height,
                weight, recovery goal, and biological profile.
              </>,
              <>
                <strong style={{ color: '#FFFFFF' }}>Usage &amp; analytics data</strong> — screens viewed,
                features used, and session activity that help us keep the app reliable and improve it.
              </>,
              <>
                <strong style={{ color: '#FFFFFF' }}>Diagnostics &amp; crash data</strong> — device model,
                operating system version, app version, crash logs, and performance metrics.
              </>,
            ]}
          />
          <p style={{ marginTop: 20, color: SECONDARY }}>
            Health and fitness data is used only to power features inside the app. We never use health data for
            advertising or tracking, and we never share it with third parties for advertising.
          </p>
        </Section>

        {/* ── 02 — How we use it ── */}
        <Section index="02" heading="How we use it">
          <p>
            We use your information to calibrate your scores and coaching, deliver the features you ask for,
            personalize your hydration and recovery recommendations, authenticate you and keep your account
            secure, process purchases and subscriptions through our payment provider (Stripe), and diagnose
            crashes so we can fix bugs and improve the app.
          </p>
          <p style={{ marginTop: 16, color: SECONDARY }}>
            We do not sell your personal data, and we do not use health data for advertising.
          </p>
        </Section>

        {/* ── 03 — Where it lives ── */}
        <Section index="03" heading="Where it lives">
          <p>
            Profile and event data are stored on secure, managed infrastructure. Sensitive items like
            authentication tokens never leave your device unencrypted. Payment information is handled by
            Stripe and never touches our servers. Your data is protected with TLS in transit and
            industry-standard encryption at rest.
          </p>
        </Section>

        {/* ── 04 — Third parties ── */}
        <Section index="04" heading="Third parties">
          <p>
            We rely on a small set of service providers. Each receives only the minimum data required to
            perform its function:
          </p>
          <List
            items={[
              <>
                <strong style={{ color: '#FFFFFF' }}>Clerk</strong> — authentication
              </>,
              <>
                <strong style={{ color: '#FFFFFF' }}>Stripe</strong> — payments
              </>,
              <>
                <strong style={{ color: '#FFFFFF' }}>ElevenLabs</strong> — voice
              </>,
              <>
                <strong style={{ color: '#FFFFFF' }}>OpenWeather</strong> — environment
              </>,
            ]}
          />
          <p style={{ marginTop: 20, color: SECONDARY }}>
            We do not sell your personal data, and we never share health data with third parties for
            advertising.
          </p>
        </Section>

        {/* ── 05 — Children under 16 ── */}
        <Section index="05" heading="Children under 16">
          <p>
            AForce OS is not directed at children under 16, and we do not knowingly collect data from them. If
            you believe a minor has created an account, contact us and we will remove it promptly.
          </p>
        </Section>

        {/* ── 06 — Your controls and rights ── */}
        <Section index="06" heading="Your controls and rights">
          <p>
            You can edit your profile at any time, disconnect any health-platform integration, cancel your
            subscription, or delete your account. To make a request, contact us using the details below and we
            will action it within 30 days.
          </p>
          <p style={{ marginTop: 16 }}>
            Depending on where you live, you may have the right to access the personal information we hold
            about you, correct inaccurate information, delete your information, port it to another service, and
            object to or restrict certain processing.
          </p>
          <p style={{ marginTop: 16 }}>
            <strong style={{ color: '#FFFFFF' }}>California residents</strong> have rights under the CCPA /
            CPRA, including the right to know, delete, correct, and limit the use of sensitive personal
            information. We do not sell or share personal information as defined under the CCPA.
          </p>
          <p style={{ marginTop: 16 }}>
            <strong style={{ color: '#FFFFFF' }}>EU and UK residents</strong> have rights under the GDPR / UK
            GDPR, including the right to withdraw consent for permission-based features (camera, location,
            health platforms) at any time in your device settings, and the right to lodge a complaint with a
            supervisory authority.
          </p>
        </Section>

        {/* ── 07 — Changes to this policy ── */}
        <Section index="07" heading="Changes to this policy">
          <p>
            We may update this policy from time to time. When it changes materially, we will post the updated
            policy with a new “Last Updated” date and notify you in-app before the change takes effect. Your
            continued use of AForce OS after changes take effect constitutes acceptance of the updated policy.
          </p>
        </Section>

        {/* ── Contact ── */}
        <section
          style={{
            borderTop: `1px solid ${SIGNAL_RED}`,
            marginTop: 56,
            paddingTop: 40,
          }}
        >
          <Eyebrow>Contact Information</Eyebrow>
          <address
            style={{
              fontStyle: 'normal',
              color: '#FFFFFF',
              fontSize: 'clamp(0.95rem, 2.4vw, 1.05rem)',
              lineHeight: 1.8,
            }}
          >
            <div style={{ fontWeight: 700 }}>AForce Hydration</div>
            <div style={{ color: SECONDARY }}>535 Fifth Avenue, 4th Floor #1004</div>
            <div style={{ color: SECONDARY }}>New York, NY 10017</div>
            <div style={{ marginTop: 14 }}>
              Email:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>
                {CONTACT_EMAIL}
              </a>
            </div>
            <div>
              Website:{' '}
              <a href={WEBSITE_URL} style={linkStyle}>
                {WEBSITE_URL}
              </a>
            </div>
          </address>
        </section>
      </main>
    </div>
  );
}

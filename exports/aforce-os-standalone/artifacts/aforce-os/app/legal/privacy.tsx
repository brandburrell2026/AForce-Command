/**
 * Privacy Policy — production-ready starter draft.
 * Final wording should be confirmed by counsel before public launch.
 */

import React from 'react';
import { LegalDocumentScreen, type LegalSection } from '@/components/LegalDocumentScreen';

const SECTIONS: LegalSection[] = [
  {
    heading: 'What we collect',
    body:
      'Account info you give us (name, email, password via Clerk), profile signals you choose ' +
      'to enter (height, weight, recovery goal, biological profile), hydration and recovery ' +
      'events you log, and optional integrations from health platforms you connect (e.g. Apple ' +
      'Health, Oura). We also collect basic device and usage telemetry to keep the app reliable.',
  },
  {
    heading: 'How we use it',
    body:
      'To calibrate your scores and coaching, to deliver the features you ask for, to process ' +
      'purchases and subscriptions through our payment provider (Stripe), and to improve the ' +
      'app. We do not sell your personal data.',
  },
  {
    heading: 'Where it lives',
    body:
      'Profile and event data are stored on secure managed infrastructure. Sensitive items like ' +
      'auth tokens never leave your device unencrypted. Payment information is handled by ' +
      'Stripe and never touches our servers.',
  },
  {
    heading: 'Your controls',
    body:
      'You can edit your profile at any time from the Identity sheet, disconnect any health ' +
      'platform integration, cancel your subscription, or delete your account. Email ' +
      'privacy@aforce.com and we will action requests within 30 days.',
  },
  {
    heading: 'Third parties',
    body:
      'We use Clerk for authentication, Stripe for payments, ElevenLabs for voice synthesis, ' +
      'OpenWeather for environmental signals, and standard cloud and analytics providers. ' +
      'Each only receives the minimum data required to perform its function.',
  },
  {
    heading: 'Children',
    body:
      'AForce OS is not directed at children under 16 and we do not knowingly collect data ' +
      'from them. If you believe a minor has created an account, contact us and we will remove ' +
      'it promptly.',
  },
  {
    heading: 'Changes',
    body:
      'When this policy changes materially we will notify you in-app before the change takes ' +
      'effect.',
  },
];

export default function PrivacyScreen() {
  return (
    <LegalDocumentScreen
      eyebrow="LEGAL"
      title="Privacy Policy"
      updatedAt="May 2026"
      intro="We collect what we need to make the product work, store it carefully, and give you control."
      sections={SECTIONS}
      footer="Privacy questions? Contact privacy@aforce.com."
    />
  );
}

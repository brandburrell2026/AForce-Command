/**
 * Privacy Policy — in-app legal screen.
 *
 * This screen MIRRORS the public policy published at
 * https://www.drinkaforce.com/privacy (legal language sourced from
 * artifacts/aforce-os/legal/privacy-policy.md). The two surfaces must tell the
 * identical story — do not paraphrase here. If the published page changes,
 * update this copy in lockstep.
 *
 * Rendered through the shared LegalDocumentScreen chrome; section bodies are
 * plain strings (the component renders text only), so bulleted lists are
 * expressed with line breaks.
 */

import React from 'react';
import { LegalDocumentScreen, type LegalSection } from '@/components/LegalDocumentScreen';

const SECTIONS: LegalSection[] = [
  {
    heading: 'What we collect',
    body:
      'We collect only what we need to run AForce OS and personalize your experience:\n\n' +
      '•  Health & fitness data — hydration and recovery events you log, and optional signals ' +
      'from health platforms you connect (for example Apple Health or Oura), such as heart rate, ' +
      'heart-rate variability, sleep, and workouts.\n\n' +
      '•  Email — the email address you use to create and sign in to your account.\n\n' +
      '•  User ID — an authentication identifier created when you sign in (handled by Clerk), plus ' +
      'profile signals you choose to enter such as height, weight, recovery goal, and biological ' +
      'profile.\n\n' +
      '•  Usage & analytics data — screens viewed, features used, and session activity that help ' +
      'us keep the app reliable and improve it.\n\n' +
      '•  Diagnostics & crash data — device model, operating system version, app version, crash ' +
      'logs, and performance metrics.\n\n' +
      'Health and fitness data is used only to power features inside the app. We never use health ' +
      'data for advertising or tracking, and we never share it with third parties for advertising.',
  },
  {
    heading: 'How we use it',
    body:
      'We use your information to calibrate your scores and coaching, deliver the features you ask ' +
      'for, personalize your hydration and recovery recommendations, authenticate you and keep ' +
      'your account secure, process purchases and subscriptions through our payment provider ' +
      '(Stripe), and diagnose crashes so we can fix bugs and improve the app.\n\n' +
      'We do not sell your personal data, and we do not use health data for advertising.',
  },
  {
    heading: 'Where it lives',
    body:
      'Profile and event data are stored on secure, managed infrastructure. Sensitive items like ' +
      'authentication tokens never leave your device unencrypted. Payment information is handled ' +
      'by Stripe and never touches our servers. Your data is protected with TLS in transit and ' +
      'industry-standard encryption at rest.',
  },
  {
    heading: 'Third parties',
    body:
      'We rely on a small set of service providers. Each receives only the minimum data required ' +
      'to perform its function:\n\n' +
      '•  Clerk — authentication\n' +
      '•  Stripe — payments\n' +
      '•  ElevenLabs — voice\n' +
      '•  OpenWeather — environment\n\n' +
      'We do not sell your personal data, and we never share health data with third parties for ' +
      'advertising.',
  },
  {
    heading: 'Children under 16',
    body:
      'AForce OS is not directed at children under 16, and we do not knowingly collect data from ' +
      'them. If you believe a minor has created an account, contact us and we will remove it ' +
      'promptly.',
  },
  {
    heading: 'Your controls and rights',
    body:
      'You can edit your profile at any time, disconnect any health-platform integration, cancel ' +
      'your subscription, or delete your account. To make a request, contact us using the details ' +
      'below and we will action it within 30 days.\n\n' +
      'Depending on where you live, you may have the right to access the personal information we ' +
      'hold about you, correct inaccurate information, delete your information, port it to another ' +
      'service, and object to or restrict certain processing.\n\n' +
      'California residents have rights under the CCPA / CPRA, including the right to know, delete, ' +
      'correct, and limit the use of sensitive personal information. We do not sell or share ' +
      'personal information as defined under the CCPA.\n\n' +
      'EU and UK residents have rights under the GDPR / UK GDPR, including the right to withdraw ' +
      'consent for permission-based features (camera, location, health platforms) at any time in ' +
      'your device settings, and the right to lodge a complaint with a supervisory authority.',
  },
  {
    heading: 'Changes to this policy',
    body:
      'We may update this policy from time to time. When it changes materially, we will post the ' +
      'updated policy with a new “Last Updated” date and notify you in-app before the change takes ' +
      'effect. Your continued use of AForce OS after changes take effect constitutes acceptance of ' +
      'the updated policy.',
  },
];

const CONTACT =
  'AForce Hydration\n' +
  '535 Fifth Avenue, 4th Floor #1004\n' +
  'New York, NY 10017\n' +
  'Email: bburrell@alkalineforce.com\n' +
  'Website: https://www.drinkaforce.com';

export default function PrivacyScreen() {
  return (
    <LegalDocumentScreen
      eyebrow="LEGAL"
      title="Privacy Policy"
      updatedAt="June 24, 2026"
      intro="We collect what we need to make the product work, store it carefully, and give you control. This policy explains what AForce OS collects, how we use it, and the rights you have over your information."
      sections={SECTIONS}
      footer={CONTACT}
    />
  );
}

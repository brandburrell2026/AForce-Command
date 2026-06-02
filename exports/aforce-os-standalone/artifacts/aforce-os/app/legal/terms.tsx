/**
 * Terms of Service — production-ready starter draft.
 * Final wording should be confirmed by counsel before public launch.
 */

import React from 'react';
import { LegalDocumentScreen, type LegalSection } from '@/components/LegalDocumentScreen';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Acceptance',
    body:
      'By creating an account or using AForce OS, you agree to these Terms. ' +
      'If you do not agree, please do not use the app.',
  },
  {
    heading: 'What AForce OS is',
    body:
      'AForce OS is a performance, recovery, and hydration intelligence app for adults. ' +
      'It surfaces estimates, signals, and coaching prompts derived from the information you ' +
      'choose to share with us. It is a wellness tool — not a medical device, diagnostic, or ' +
      'treatment service.',
  },
  {
    heading: 'Your account',
    body:
      'You are responsible for the accuracy of the information you enter and for keeping your ' +
      'login credentials secure. You must be at least 16 years old to use AForce OS.',
  },
  {
    heading: 'Subscriptions and purchases',
    body:
      'Some features require a paid subscription or one-time purchase. Pricing, taxes, and ' +
      'shipping are confirmed in-app at checkout. Subscriptions renew automatically until ' +
      'cancelled. You can manage or cancel at any time from your platform’s subscription settings.',
  },
  {
    heading: 'Acceptable use',
    body:
      'Don’t reverse engineer the app, abuse APIs, scrape data, or use AForce OS to harass ' +
      'other members. We may suspend or terminate accounts that violate these Terms.',
  },
  {
    heading: 'Disclaimer of warranties',
    body:
      'AForce OS is provided “as is.” We do not warrant that estimates, scores, or ' +
      'recommendations will be accurate, uninterrupted, or appropriate for any specific ' +
      'individual or situation.',
  },
  {
    heading: 'Limitation of liability',
    body:
      'To the maximum extent permitted by law, AForce and its affiliates are not liable for ' +
      'indirect, incidental, special, or consequential damages arising out of your use of the app.',
  },
  {
    heading: 'Changes',
    body:
      'We may update these Terms from time to time. Material changes will be surfaced in-app. ' +
      'Continued use after changes take effect means you accept the updated Terms.',
  },
];

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      eyebrow="LEGAL"
      title="Terms of Service"
      updatedAt="May 2026"
      intro="The short version: AForce OS is a wellness and performance tool. Use it as one signal among many — never as a substitute for professional advice."
      sections={SECTIONS}
      footer="Questions about these Terms? Contact support@aforce.com."
    />
  );
}

/**
 * Health Disclaimer — performance / wellness framing.
 * AForce OS is positioned as a performance tool, never a medical device.
 */

import React from 'react';
import { LegalDocumentScreen, type LegalSection } from '@/components/legal/LegalDocumentGated';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Performance, not medicine',
    body:
      'AForce OS is a performance, recovery, and hydration intelligence app. Every score, ' +
      'signal, and coaching prompt is an estimate intended to help you make better daily ' +
      'training and recovery decisions. Nothing in the app is medical advice, a diagnosis, or ' +
      'a treatment plan.',
  },
  {
    heading: 'Talk to a professional first',
    body:
      'If you have a medical condition, are pregnant, take prescription medication, are ' +
      'recovering from injury or illness, or are unsure whether a training or hydration plan ' +
      'is right for you, talk to a qualified clinician before changing what you do.',
  },
  {
    heading: 'Estimates have limits',
    body:
      'Hydration scores, sweat estimates, Recovery Capacity, Smart Capture, HydroScan, and the ' +
      'urine signal check rely on the data you provide and on physiological averages. They will ' +
      'sometimes be wrong. Use them as one signal among many — never as the only input to a ' +
      'health decision.',
  },
  {
    heading: 'In an emergency',
    body:
      'If you experience symptoms of severe dehydration, heat illness, or any medical ' +
      'emergency, stop using the app and contact local emergency services or a clinician ' +
      'immediately.',
  },
  {
    heading: 'You are in charge',
    body:
      'By using AForce OS you confirm that you are responsible for your own training, ' +
      'hydration, and recovery choices, and that you will not rely on the app as a substitute ' +
      'for professional medical advice.',
  },
];

export default function HealthDisclaimerScreen() {
  return (
    <LegalDocumentScreen
      eyebrow="LEGAL"
      title="Health Disclaimer"
      updatedAt="May 2026"
      intro="AForce OS supports your performance — it does not replace your doctor."
      sections={SECTIONS}
    />
  );
}

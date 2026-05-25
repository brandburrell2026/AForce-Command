/**
 * Cruise → Recovery (hidden — Rule #15).
 *
 * Cruise-context recovery: after sun, after excursion, after a long
 * port day, after social mode. Distinct from the main app's Recovery
 * screen — same engine underneath, but framed for sailing life
 * (cabin temperature, ship motion, time-zone drift).
 */

import React from 'react';

import { CruiseScreen, Placeholder, Row, Section } from './_shared';

export default function CruiseRecoveryScreen() {
  return (
    <CruiseScreen
      eyebrow="Cruise · Recovery"
      title="Recover for tomorrow"
      hero={{ value: '—', unit: '%', caption: 'Recovery score not yet wired' }}>
      <Section label="Today's load">
        <Row label="Heat dose" value="—" />
        <Row label="Walking load" value="—" />
        <Row label="Social mode" value="—" />
        <Row label="Excursion impact" value="—" />
      </Section>

      <Section label="Replenishment plan">
        <Row label="Remaining water" value="—" emphasis />
        <Row label="AForce sticks tonight" value="—" emphasis />
        <Row label="Cut-off time" value="—" />
      </Section>

      <Section label="Sleep on board">
        <Placeholder>
          Cabin-aware sleep guidance: cabin temperature target, motion
          alert (if rough seas forecast), and a soft lights-out cue
          synced to tomorrow&apos;s all-aboard.
        </Placeholder>
      </Section>

      <Section label="Time-zone reset">
        <Placeholder>
          When the sailing crosses zones, this surface walks the
          two-day reset — shifted melatonin window, shifted hydration
          window, shifted protocol stage.
        </Placeholder>
      </Section>
    </CruiseScreen>
  );
}

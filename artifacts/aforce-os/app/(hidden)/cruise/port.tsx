/**
 * Cruise → Port (hidden — Rule #15).
 *
 * Where you are right now: port name, local climate, on-shore
 * hydration cost, all-aboard countdown. Read-only projection; no
 * mutation hooks land in this rule.
 */

import React from 'react';

import { CruiseScreen, Placeholder, Row, Section } from './_shared';

export default function CruisePortScreen() {
  return (
    <CruiseScreen
      eyebrow="Cruise · Port"
      title="On shore"
      hero={{ value: '—:—', unit: 'all aboard', caption: 'Countdown not yet wired' }}>
      <Section label="Current port">
        <Row label="Port" value="—" />
        <Row label="Country" value="—" />
        <Row label="Local time" value="—" />
        <Row label="UTC offset" value="—" />
      </Section>

      <Section label="Climate window">
        <Row label="Temperature" value="—" />
        <Row label="Humidity" value="—" />
        <Row label="UV index" value="—" emphasis />
        <Row label="Heat strain forecast" value="—" />
      </Section>

      <Section label="Hydration cost">
        <Placeholder>
          Today&apos;s shore-side hydration delta — extra ounces the
          protocol will recommend on top of your baseline because of
          heat, UV, and walking load.
        </Placeholder>
      </Section>

      <Section label="Re-board">
        <Row label="All-aboard call" value="—" />
        <Row label="Ship departure" value="—" />
      </Section>
    </CruiseScreen>
  );
}

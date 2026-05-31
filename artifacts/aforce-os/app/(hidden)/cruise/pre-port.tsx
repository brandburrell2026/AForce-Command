/**
 * Cruise → Pre-Port (hidden — Rule #15).
 *
 * The 24 hours before a port stop: countdown, pre-loading targets,
 * and a prep checklist. Designed to drive a single-screen morning
 * brief that ends with one tap to start the day.
 */

import React from 'react';

import { CruiseScreen, Placeholder, Row, Section } from '@/components/cruise/CruiseShared';

export default function CruisePrePortScreen() {
  return (
    <CruiseScreen
      eyebrow="Cruise · Pre-Port"
      title="Tomorrow's port"
      hero={{ value: '—:—:—', unit: 'until arrival', caption: 'Countdown not yet wired' }}>
      <Section label="Arriving">
        <Row label="Port" value="—" />
        <Row label="Arrival" value="—" />
        <Row label="All-aboard" value="—" />
      </Section>

      <Section label="Pre-load targets">
        <Row label="Water tonight" value="—" emphasis />
        <Row label="AForce sticks" value="—" emphasis />
        <Row label="Lights out by" value="—" />
      </Section>

      <Section label="Prep checklist">
        <Placeholder>
          Five-item morning checklist surfaces here: hydration
          confirmed, electrolytes packed, SPF, hat, shore cash. Each
          item check-marked or skipped logs to the journal.
        </Placeholder>
      </Section>

      <Section label="Forecast snapshot">
        <Row label="High temp" value="—" />
        <Row label="UV peak" value="—" />
        <Row label="Wind" value="—" />
      </Section>
    </CruiseScreen>
  );
}

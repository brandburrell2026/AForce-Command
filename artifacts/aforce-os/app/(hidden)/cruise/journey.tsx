/**
 * Cruise → Journey (hidden — Rule #15).
 *
 * Itinerary across the full sailing: ports, sea days, time-zone
 * shifts, and where the user is right now on the arc. Data wiring
 * comes in a later rule; this turn establishes the section anatomy.
 */

import React from 'react';

import { CruiseScreen, Placeholder, Row, Section } from './_shared';

export default function CruiseJourneyScreen() {
  return (
    <CruiseScreen
      eyebrow="Cruise · Journey"
      title="Your sailing"
      hero={{ value: '—', unit: 'day of', caption: 'Itinerary not yet wired' }}>
      <Section label="Voyage">
        <Row label="Ship" value="—" />
        <Row label="Departed" value="—" />
        <Row label="Returns" value="—" />
        <Row label="Time-zone offset" value="—" />
      </Section>

      <Section label="Today">
        <Row label="Status" value="—" emphasis />
        <Row label="Local time" value="—" />
        <Row label="Sun · sunset" value="—" />
      </Section>

      <Section label="Itinerary">
        <Placeholder>
          Stop-by-stop list will populate from the sailing record:
          port name, arrival / all-aboard, and a one-line hydration
          note per day.
        </Placeholder>
      </Section>

      <Section label="Time-zone shifts">
        <Placeholder>
          Each crossing logged here so the protocol engine can
          pre-shift sleep and hydration cues a day in advance.
        </Placeholder>
      </Section>
    </CruiseScreen>
  );
}

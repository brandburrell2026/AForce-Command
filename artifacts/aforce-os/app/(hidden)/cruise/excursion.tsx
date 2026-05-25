/**
 * Cruise → Excursion (hidden — Rule #15).
 *
 * The single active excursion (booked, in progress, or just-finished)
 * and its physiological cost forecast. Multi-excursion history lives
 * inside the Journal, not here.
 */

import React from 'react';

import { CruiseScreen, Placeholder, Row, Section } from './_shared';

export default function CruiseExcursionScreen() {
  return (
    <CruiseScreen
      eyebrow="Cruise · Excursion"
      title="Today's excursion"
      hero={{ value: '—', unit: 'load score', caption: 'Forecast not yet wired' }}>
      <Section label="Activity">
        <Row label="Name" value="—" />
        <Row label="Category" value="—" />
        <Row label="Duration" value="—" />
        <Row label="Start" value="—" />
      </Section>

      <Section label="Physical load forecast">
        <Row label="Estimated steps" value="—" />
        <Row label="Heat exposure" value="—" emphasis />
        <Row label="Water target" value="—" emphasis />
        <Row label="Electrolyte target" value="—" emphasis />
      </Section>

      <Section label="Pre-flight">
        <Placeholder>
          Two-hour pre-excursion brief: top-up window, last
          electrolyte stick, last bathroom, what to carry. Becomes a
          push notification at the right time when this rule wires up
          to the scheduler.
        </Placeholder>
      </Section>

      <Section label="Post-excursion">
        <Placeholder>
          Replenishment plan + recovery routing. If load score crosses
          threshold, hands off to the Cruise → Recovery surface.
        </Placeholder>
      </Section>
    </CruiseScreen>
  );
}

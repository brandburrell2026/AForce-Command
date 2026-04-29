/**
 * Journal tab — Hydration Journal route. Mounts <JournalScreen/>
 * which fetches the timeline + rollups and renders the chart, daily
 * cards, and PDF export.
 */

import React from 'react';
import JournalScreen from '@/screens/JournalScreen';

export default function JournalRoute() {
  return <JournalScreen />;
}

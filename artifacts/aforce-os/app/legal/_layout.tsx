/**
 * Legal stack — Terms, Privacy, Health Disclaimer.
 * Each route renders the shared `LegalDocumentScreen` component.
 */

import React from 'react';
import { Stack } from 'expo-router';

export default function LegalLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

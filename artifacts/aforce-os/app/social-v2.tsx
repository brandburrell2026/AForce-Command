/**
 * /social-v2 — LEGACY compatibility redirect (NO-b).
 *
 * This route previously mounted a second copy of the Social V2 screen for
 * side-by-side comparison (Phase-0 SS-20 duplicate). It is no longer publicly
 * discoverable. Kept as a NON-destructive deep-link compatibility handler that
 * redirects to the canonical `/night-out` route (which is itself authorization-
 * gated, so an unauthorized deep link lands on Protocol — no loop).
 */
import React from 'react';
import { Redirect, type Href } from 'expo-router';

// `/night-out` is a new route; the generated expo-router route types regenerate
// on the next `expo` typegen. Cast until then.
const NIGHT_OUT_HREF = '/night-out' as unknown as Href;

export default function SocialV2LegacyRedirect() {
  return <Redirect href={NIGHT_OUT_HREF} />;
}

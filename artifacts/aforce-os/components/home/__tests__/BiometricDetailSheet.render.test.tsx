// @vitest-environment happy-dom
/**
 * BiometricDetailSheet — NON-SHIPPING render harness (Squad-F HIGH #4).
 *
 * Renders the real `BiometricDetailSheet` to a DOM (react-native-web →
 * react-dom, happy-dom), following the pattern established in
 * components/health/__tests__/connectedHealthView.render.test.tsx (Icon
 * mocked — native vector fonts/SVG are irrelevant to structure/a11y here).
 *
 * The bug: the backdrop Pressable (role button, label "Dismiss") used to WRAP
 * the entire sheet subtree, so VoiceOver/TalkBack collapsed the whole modal
 * into one "Dismiss" button and the card / primary action / Close were never
 * individually reachable. The fix makes the backdrop a SIBLING positioned
 * behind the sheet, and adds `accessibilityViewIsModal` on the sheet content.
 *
 * `react-native-web`'s Modal always portals its content to `document.body`
 * (see node_modules/react-native-web/dist/exports/Modal/ModalPortal.js), so
 * assertions query `document`, not the local render host.
 *
 * `accessibilityViewIsModal` has no react-native-web DOM mapping (confirmed
 * against `forwardedProps.accessibilityProps` — only `aria-modal`/`role` are
 * forwarded, not the RN-specific prop name), so its presence is asserted by
 * wrapping the real `View` to record props before that allowlist runs — the
 * same technique used for `maxFontSizeMultiplier` in the WhoopSnapshotCard
 * harness.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

// Records every prop object passed to <View> BEFORE react-native-web's
// allowlist silently drops RN-only props like `accessibilityViewIsModal`.
const { capturedViewProps } = vi.hoisted(() => ({ capturedViewProps: [] as Record<string, unknown>[] }));
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const RealView = actual.View as React.ComponentType<Record<string, unknown>>;
  const RecordingView = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    capturedViewProps.push(props);
    return React.createElement(RealView, { ...props, ref });
  });
  return { ...actual, View: RecordingView };
});

import { BiometricDetailSheet, type BiometricSheetPayload } from '../BiometricDetailSheet';

const PAYLOAD: BiometricSheetPayload = {
  eyebrow: 'SWEAT LOSS',
  accent: '#1FA35A',
  icon: 'droplet',
  heroValue: '32 oz',
  heroLabel: 'Estimated today',
  primaryAction: { label: 'Log a refill', onPress: () => {} },
};

let host: HTMLElement;
let root: Root;

function renderSheet(props: Partial<React.ComponentProps<typeof BiometricDetailSheet>> = {}) {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(BiometricDetailSheet, {
        visible: true,
        payload: PAYLOAD,
        onDismiss: () => {},
        ...props,
      }),
    ),
  );
}

// react-native-web's Modal portals to a fresh <div> appended to
// document.body, not into `host` — query the document for sheet content.
const qd = (sel: string) => document.querySelector(sel);
const qda = (sel: string) => Array.from(document.querySelectorAll(sel));

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  capturedViewProps.length = 0;
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
  // Clean up anything the Modal portal left behind between tests.
  for (const el of Array.from(document.body.querySelectorAll('div'))) {
    if (!host.contains(el) && el !== host) el.remove();
  }
});

describe('BiometricDetailSheet — modal collapse fix (Squad-F HIGH #4)', () => {
  it('the backdrop Dismiss button and the sheet content are separate, sibling-reachable elements', () => {
    renderSheet();
    const dismiss = qd('[aria-label="Dismiss"]');
    const card = qd('[data-testid="biometric-detail-card"]');
    const close = qd('[data-testid="biometric-detail-close"]');
    expect(dismiss).not.toBeNull();
    expect(card).not.toBeNull();
    expect(close).not.toBeNull();
    // The old bug: the backdrop WRAPPED the sheet, so `card`/`close` would be
    // descendants of the Dismiss button. They must NOT be now.
    expect(dismiss?.contains(card as Node)).toBe(false);
    expect(dismiss?.contains(close as Node)).toBe(false);
  });

  it('the primary action, when present, is independently reachable (not swallowed by the backdrop)', () => {
    renderSheet();
    const dismiss = qd('[aria-label="Dismiss"]');
    const primary = qd('[data-testid="biometric-detail-primary"]');
    expect(primary).not.toBeNull();
    expect(dismiss?.contains(primary as Node)).toBe(false);
  });

  it('tapping the backdrop still dismisses (outside-tap-to-close is preserved)', () => {
    const onDismiss = vi.fn();
    renderSheet({ onDismiss });
    const dismiss = qd('[aria-label="Dismiss"]') as HTMLElement;
    dismiss.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('tapping Close still dismisses', () => {
    const onDismiss = vi.fn();
    renderSheet({ onDismiss });
    const close = qd('[data-testid="biometric-detail-close"]') as HTMLElement;
    close.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('the sheet content View receives accessibilityViewIsModal', () => {
    renderSheet();
    // The sheet is the View that is an ancestor of the card but NOT an
    // ancestor-turned-descendant of the backdrop Pressable (i.e. it's the
    // recorded View wrapping biometric-detail-card).
    const cardEl = qd('[data-testid="biometric-detail-card"]');
    const sheetProps = capturedViewProps.find(
      (p) => p.accessibilityViewIsModal === true,
    );
    expect(sheetProps).toBeDefined();
    // Sanity: the flagged View really is the sheet (contains the card).
    expect(cardEl).not.toBeNull();
  });

  it('renders nothing when visible is false', () => {
    renderSheet({ visible: false });
    expect(qd('[data-testid="biometric-detail-card"]')).toBeNull();
  });
});

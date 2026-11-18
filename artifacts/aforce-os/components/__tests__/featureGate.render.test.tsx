// @vitest-environment happy-dom
/**
 * Stop-ship RA-N1: a locked FeatureGate must not let an ordinary production
 * member switch the feature on, and must not show the caller's feature copy.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  allowed: false,
  flags: { guardian_intelligence_enabled: false } as Record<string, boolean>,
  setFeatureFlags: vi.fn(),
}));

vi.mock('../Icon', () => ({ Icon: () => null }));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => ({ state: { featureFlags: h.flags }, setFeatureFlags: h.setFeatureFlags }),
}));
vi.mock('../../featureFlags/flags', () => ({
  featureGateSelfActivationAllowed: () => h.allowed,
}));

import { FeatureGate, FEATURE_GATE_UNAVAILABLE_COPY } from '../FeatureGate';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DESCRIPTION = 'Per-athlete risk scoring. Activate to preview.';

async function render(props: { onUpgrade?: () => void } = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <FeatureGate
        flag={'guardian_intelligence_enabled' as never}
        title="Guardian Intelligence"
        description={DESCRIPTION}
        {...props}
      >
        <div data-child />
      </FeatureGate>,
    ),
  );
  return {
    host,
    cta: () => host.querySelector('[data-testid="feature-gate-activate"]') as HTMLElement | null,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

beforeEach(() => {
  h.allowed = false;
  h.flags = { guardian_intelligence_enabled: false };
  h.setFeatureFlags.mockClear();
});

describe('FeatureGate', () => {
  it('production: no activate control, neutral copy, children hidden', async () => {
    const v = await render();
    try {
      expect(v.cta()).toBeNull();
      expect(v.host.querySelector('[data-child]')).toBeNull();
      expect(v.host.textContent).toContain('NOT AVAILABLE');
      expect(v.host.textContent).toContain(FEATURE_GATE_UNAVAILABLE_COPY);
      expect(v.host.textContent).not.toContain(DESCRIPTION);
      expect(v.host.textContent).not.toContain('Activate');
    } finally {
      v.cleanup();
    }
  });

  it('developer build: the control is offered and flips only this flag', async () => {
    h.allowed = true;
    const v = await render();
    try {
      expect(v.host.textContent).toContain('DEMO LOCKED');
      expect(v.host.textContent).toContain(DESCRIPTION);
      const cta = v.cta();
      expect(cta).toBeTruthy();
      await act(async () => cta!.click());
      expect(h.setFeatureFlags).toHaveBeenCalledTimes(1);
      expect(h.setFeatureFlags).toHaveBeenCalledWith({ guardian_intelligence_enabled: true });
    } finally {
      v.cleanup();
    }
  });

  it('a caller-supplied onUpgrade keeps its control and never flips the flag', async () => {
    const onUpgrade = vi.fn();
    const v = await render({ onUpgrade });
    try {
      const cta = v.cta();
      expect(cta).toBeTruthy();
      await act(async () => cta!.click());
      expect(onUpgrade).toHaveBeenCalledTimes(1);
      expect(h.setFeatureFlags).not.toHaveBeenCalled();
    } finally {
      v.cleanup();
    }
  });

  it('an enabled flag renders the children and no placeholder', async () => {
    h.flags = { guardian_intelligence_enabled: true };
    const v = await render();
    try {
      expect(v.host.querySelector('[data-child]')).toBeTruthy();
      expect(v.cta()).toBeNull();
    } finally {
      v.cleanup();
    }
  });
});

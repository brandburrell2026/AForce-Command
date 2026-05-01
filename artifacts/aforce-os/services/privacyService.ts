/**
 * Privacy service — read/write the user's share visibility and per-field
 * controls.
 *
 * Backed by the api-server `/api/privacy` endpoint. Preserves the
 * synchronous, defensively-cloned read surface from the original
 * in-memory implementation so existing tests + the
 * `useSyncExternalStore` consumers in `MySharedStatusScreen` keep
 * working unchanged.
 *
 * Mutations are optimistic: we update the local snapshot + emit
 * immediately, then PUT to the server in the background. On failure we
 * re-fetch to recover.
 */

import { DEFAULT_PRIVACY } from '@/data/mockCircleData';
import type { PrivacySettings, ShareScope, SharedStatus } from '@/types/circle';
import { getJsonAforceApi, putJsonAforceApi } from '@/services/aforceApiClient';

let current: PrivacySettings = { ...DEFAULT_PRIVACY, fields: { ...DEFAULT_PRIVACY.fields } };
let hydrated = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<(p: PrivacySettings) => void>();

function applyServer(p: PrivacySettings): void {
  current = {
    scope: p.scope,
    fields: {
      score: p.fields.score,
      state: p.fields.state,
      streak: p.fields.streak,
      protocol: p.fields.protocol,
      trend: p.fields.trend,
    },
  };
}

function ensureHydrated(): void {
  if (hydrated || inflight) return;
  inflight = (async () => {
    try {
      const res = await getJsonAforceApi<{ privacy: PrivacySettings }>('/privacy');
      applyServer(res.privacy);
      hydrated = true;
      emit();
    } catch {
      // Stay on DEFAULT_PRIVACY — caller still gets a sensible snapshot.
    } finally {
      inflight = null;
    }
  })();
}

export function getPrivacy(): PrivacySettings {
  ensureHydrated();
  return { ...current, fields: { ...current.fields } };
}

export function setScope(scope: ShareScope): PrivacySettings {
  current = { ...current, scope };
  emit();
  void (async () => {
    try {
      const res = await putJsonAforceApi<{ privacy: PrivacySettings }>(
        '/privacy/scope',
        { scope },
      );
      applyServer(res.privacy);
      emit();
    } catch {
      hydrated = false;
      ensureHydrated();
    }
  })();
  return getPrivacy();
}

export function setField(field: keyof PrivacySettings['fields'], on: boolean): PrivacySettings {
  current = { ...current, fields: { ...current.fields, [field]: on } };
  emit();
  void (async () => {
    try {
      const res = await putJsonAforceApi<{ privacy: PrivacySettings }>(
        '/privacy/field',
        { field, on },
      );
      applyServer(res.privacy);
      emit();
    } catch {
      hydrated = false;
      ensureHydrated();
    }
  })();
  return getPrivacy();
}

export function subscribePrivacy(fn: (p: PrivacySettings) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function emit() {
  for (const fn of listeners) {
    try { fn(getPrivacy()); } catch { /* swallow */ }
  }
}

/**
 * Return the user's status filtered to only the fields they've allowed to
 * share. Use this everywhere a status snapshot leaves the device.
 */
export function projectSharedStatus(status: SharedStatus): SharedStatus {
  const p = getPrivacy();
  if (p.scope === 'private') {
    // Private scope obfuscates everything — including `updatedAt`, which
    // would otherwise leak a "last seen" signal to anyone who happened to
    // receive a stale projection.
    return {
      userId: status.userId,
      score: 0, state: 'Balanced', streakDays: 0, protocolComplete: false,
      trend: 'flat', updatedAt: '',
    };
  }
  return {
    userId: status.userId,
    score:           p.fields.score    ? status.score            : 0,
    state:           p.fields.state    ? status.state            : 'Balanced',
    streakDays:      p.fields.streak   ? status.streakDays       : 0,
    protocolComplete: p.fields.protocol ? status.protocolComplete : false,
    trend:           p.fields.trend    ? status.trend            : 'flat',
    updatedAt:       status.updatedAt,
  };
}

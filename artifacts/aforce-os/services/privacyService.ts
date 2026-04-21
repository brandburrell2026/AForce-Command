/**
 * Privacy service — read/write the user's share visibility and per-field
 * controls. Backed by an in-memory state today; will persist to the
 * api-server `/api/privacy` endpoint once shipped.
 */

import { DEFAULT_PRIVACY } from '@/data/mockCircleData';
import type { PrivacySettings, ShareScope, SharedStatus } from '@/types/circle';

let current: PrivacySettings = { ...DEFAULT_PRIVACY, fields: { ...DEFAULT_PRIVACY.fields } };
const listeners = new Set<(p: PrivacySettings) => void>();

export function getPrivacy(): PrivacySettings {
  return { ...current, fields: { ...current.fields } };
}

export function setScope(scope: ShareScope): PrivacySettings {
  current = { ...current, scope };
  emit();
  return getPrivacy();
}

export function setField(field: keyof PrivacySettings['fields'], on: boolean): PrivacySettings {
  current = { ...current, fields: { ...current.fields, [field]: on } };
  emit();
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

/**
 * The connected One Breath conversation is reachable in internal builds only,
 * for a new plan and for a sealed or locked-in one (Brandon, 2026-11-21). It is still not for outside
 * testers until it has passed device testing and its wording is reviewed.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { oneBreathOpensConversation } from '@/utils/oneBreath/conversationRoute';
import type { Moment } from '@/types/moments';

const AOS = join(__dirname, '..', '..', '..');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
const prep = (over: Record<string, unknown> = {}) => ({ version: 1, context: 'one_breath', transactionId: 't', reviewedAtIso: '2026-11-20T10:00:00Z', sealedAtIso: '2026-11-20T10:00:00Z', returnMethod: 'none', destination: '', emergencyNumber: '911', steps: [], policyVersion: 'social-v0.4-phase-a', ...over });
const moment = (preparation?: unknown): Moment => ({ id: 'm', source: 'manual', title: 'Lift', type: 'training', importance: 'high', startAtIso: '2026-11-21T10:00:00Z', createdAtIso: '2026-11-20T10:00:00Z', preparation } as Moment);
const base = { internal: true, hydrated: true, moments: [] as Moment[] };

describe('One Breath conversation · where it opens', () => {
  it('only the One Breath route mounts it, behind the internal-build gate', () => {
    const users = walk(join(AOS, 'app')).filter((f) => /OneBreathConversationScreen/.test(readFileSync(f, 'utf8')));
    expect(users.map((f) => f.slice(AOS.length + 1))).toEqual([join('app', 'one-breath.tsx')]);
    const route = readFileSync(join(AOS, 'app', 'one-breath.tsx'), 'utf8');
    expect(route).toMatch(/if \(preparationPreviewEnabled\(\)\) return <InternalOneBreath/);
    expect(route.indexOf('<OneBreathConversationScreen')).toBeGreaterThan(route.indexOf('function InternalOneBreath'));
    const others = [...walk(join(AOS, 'components')), ...walk(join(AOS, 'screens')), ...walk(join(AOS, 'hooks'))]
      .filter((f) => !f.endsWith('OneBreathConversationScreen.tsx'))
      .filter((f) => /OneBreathConversationScreen/.test(readFileSync(f, 'utf8')));
    expect(others).toEqual([]);
  });

  it('a new plan in an internal build opens the conversation', () => {
    expect(oneBreathOpensConversation(base)).toBe(true);
    expect(oneBreathOpensConversation({ ...base, moments: [moment()] })).toBe(true);
  });

  it('outside internal builds, or before Moments have loaded, it never does', () => {
    expect(oneBreathOpensConversation({ ...base, internal: false })).toBe(false);
    expect(oneBreathOpensConversation({ ...base, hydrated: false })).toBe(false);
  });

  it('a Moment opened by id, or a calendar proposal, keeps the existing screens', () => {
    expect(oneBreathOpensConversation({ ...base, momentId: 'm' })).toBe(false);
    expect(oneBreathOpensConversation({ ...base, proposal: 'p' })).toBe(false);
  });

  it('a sealed plan, and a plan in Quiet, open in the conversation as the prototype shows them', () => {
    expect(oneBreathOpensConversation({ ...base, moments: [moment(prep())] })).toBe(true);
    expect(oneBreathOpensConversation({ ...base, moments: [moment(prep({ lockedInAtIso: '2026-11-20T10:05:00Z' }))] })).toBe(true);
    // A Social plan is not One Breath's.
    expect(oneBreathOpensConversation({ ...base, moments: [moment(prep({ context: 'social' }))] })).toBe(true);
  });

  it('a plan saved but never sealed keeps the existing Plan screen', () => {
    expect(oneBreathOpensConversation({ ...base, moments: [moment(prep({ sealedAtIso: '' }))] })).toBe(false);
  });

  it('the connected screen uses no AI model and writes nothing itself', () => {
    const src = readFileSync(join(AOS, 'components', 'oneBreath', 'OneBreathConversationScreen.tsx'), 'utf8');
    expect(src).not.toMatch(/anthropic|openai|fetch\(|scopedStorage|AsyncStorage/i);
    expect(src).toMatch(/commitReviewedMoment/);
    expect(src).toMatch(/lockInWithoutReminders/);
    expect(src).toMatch(/postRecordedDrink/);
  });
});

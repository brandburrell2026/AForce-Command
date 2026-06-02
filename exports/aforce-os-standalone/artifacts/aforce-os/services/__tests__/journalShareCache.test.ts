import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  publishJournalShare,
  readJournalShare,
  clearJournalShare,
  JOURNAL_SHARE_TTL_MS,
} from '../journalShareCache';
import type { JournalRollup } from '../../types';

const sampleRollup = (date: string, avgScore: number): JournalRollup => ({
  date,
  snapshotsCount: 6,
  avgScore,
  minScore: Math.max(0, avgScore - 10),
  maxScore: Math.min(100, avgScore + 10),
  endOzConsumed: 80,
  endAforceUnits: 2,
  endUnitsConsumed: 2,
  endSodiumDelivered: 800,
  endSodiumLost: 600,
  endDeficitPct: 5,
  pctTimePeak: 30,
  pctTimeBalanced: 50,
  pctTimeRecovering: 15,
  pctTimeDepleted: 5,
  intakeCount: 4,
  autopilotSessions: 0,
  socialSessions: 0,
});

describe('journalShareCache', () => {
  beforeEach(() => {
    clearJournalShare();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when nothing has been published', () => {
    expect(readJournalShare()).toBeNull();
  });

  it('round-trips published payload', () => {
    const rollups = [sampleRollup('2026-04-25', 78), sampleRollup('2026-04-26', 82)];
    publishJournalShare(rollups, 7);
    const got = readJournalShare();
    expect(got).not.toBeNull();
    expect(got!.rollups).toHaveLength(2);
    expect(got!.rollups[1].avgScore).toBe(82);
    expect(got!.rangeDays).toBe(7);
    expect(got!.publishedAt).toBeGreaterThan(0);
  });

  it('persists across multiple reads (UI re-renders) until cleared', () => {
    publishJournalShare([sampleRollup('2026-04-25', 90)], 30);
    expect(readJournalShare()).not.toBeNull();
    expect(readJournalShare()).not.toBeNull(); // second read still works
    clearJournalShare();
    expect(readJournalShare()).toBeNull();
  });

  it('publishing again replaces the previous payload', () => {
    publishJournalShare([sampleRollup('2026-04-25', 50)], 7);
    publishJournalShare([sampleRollup('2026-04-26', 88)], 30);
    const got = readJournalShare();
    expect(got!.rollups[0].avgScore).toBe(88);
    expect(got!.rangeDays).toBe(30);
  });

  it('defensively copies the input array so external mutations do not bleed in', () => {
    const rollups = [sampleRollup('2026-04-25', 78)];
    publishJournalShare(rollups, 7);
    rollups.push(sampleRollup('2026-04-26', 0));
    const got = readJournalShare();
    expect(got!.rollups).toHaveLength(1);
  });

  it('deep-copies each rollup so mutating a published row does not corrupt the cache', () => {
    const original = sampleRollup('2026-04-25', 78);
    publishJournalShare([original], 7);
    original.avgScore = 0; // simulate caller mutating after publish
    const got = readJournalShare();
    expect(got!.rollups[0].avgScore).toBe(78);
  });

  it('returns null after TTL has elapsed (stale-leak protection)', () => {
    vi.useFakeTimers();
    const t0 = new Date('2026-05-02T12:00:00Z');
    vi.setSystemTime(t0);
    publishJournalShare([sampleRollup('2026-04-25', 78)], 7);
    expect(readJournalShare()).not.toBeNull();
    // Survives a short StrictMode-style remount.
    vi.advanceTimersByTime(1_000);
    expect(readJournalShare()).not.toBeNull();
    // Expires after TTL.
    vi.advanceTimersByTime(JOURNAL_SHARE_TTL_MS + 1);
    expect(readJournalShare()).toBeNull();
  });
});

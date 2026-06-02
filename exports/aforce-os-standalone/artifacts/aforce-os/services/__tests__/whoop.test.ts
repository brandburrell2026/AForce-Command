import { describe, it, expect, vi } from 'vitest';

import { fetchWhoopSnapshot, toProviderSnapshot, WHOOP_API_BASE } from '../whoop';

describe('whoop', () => {
  it('returns the empty snapshot when accessToken is null/empty', async () => {
    expect(await fetchWhoopSnapshot({ accessToken: null })).toEqual({
      recoveryPct: null,
      strain: null,
      hrvSdnn: null,
      restingHeartRate: null,
      sleepHoursLastNight: null,
    });
    expect((await fetchWhoopSnapshot({ accessToken: '   ' })).strain).toBeNull();
  });

  it('maps recovery + cycle + sleep payloads onto the snapshot shape', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/recovery')) {
        return new Response(
          JSON.stringify({
            records: [
              { score: { recovery_score: 78, hrv_rmssd_milli: 62, resting_heart_rate: 54 } },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/cycle')) {
        return new Response(JSON.stringify({ records: [{ score: { strain: 14.5 } }] }), {
          status: 200,
        });
      }
      if (url.includes('/activity/sleep')) {
        return new Response(
          JSON.stringify({
            records: [
              {
                score: {
                  stage_summary: {
                    total_in_bed_time_milli: 8 * 60 * 60 * 1000,
                    total_awake_time_milli: 30 * 60 * 1000,
                  },
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;

    const snap = await fetchWhoopSnapshot({ accessToken: 'tkn', fetchImpl });
    expect(snap.recoveryPct).toBe(78);
    expect(snap.strain).toBe(14.5);
    expect(snap.hrvSdnn).toBe(62);
    expect(snap.restingHeartRate).toBe(54);
    expect(snap.sleepHoursLastNight).toBeCloseTo(7.5, 1);
  });

  it('returns nulls for missing payload fields without throwing', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ records: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const snap = await fetchWhoopSnapshot({ accessToken: 'tkn', fetchImpl });
    expect(snap).toEqual({
      recoveryPct: null,
      strain: null,
      hrvSdnn: null,
      restingHeartRate: null,
      sleepHoursLastNight: null,
    });
  });

  it('survives an HTTP error gracefully', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('boom', { status: 500 }),
    ) as unknown as typeof fetch;
    const snap = await fetchWhoopSnapshot({ accessToken: 'tkn', fetchImpl });
    expect(snap.recoveryPct).toBeNull();
  });

  it('toProviderSnapshot tags with the whoop provider id', () => {
    const lifted = toProviderSnapshot(
      { recoveryPct: 60, strain: 12, hrvSdnn: 55, restingHeartRate: 56, sleepHoursLastNight: 7.4 },
      1700000000000,
    );
    expect(lifted.providerId).toBe('whoop');
    expect(lifted.strain).toBe(12);
    expect(lifted.recoveryPct).toBe(60);
  });

  it('WHOOP_API_BASE is the v1 developer endpoint', () => {
    expect(WHOOP_API_BASE).toBe('https://api.prod.whoop.com/developer/v1');
  });
});

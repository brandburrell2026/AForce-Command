/**
 * "Today" ends at the member's own midnight (founder direction, 2026-11-21).
 *
 * Found on a founder's phone: the daily total was reset at midnight UTC,
 * which is 7 PM Eastern. Two waters logged on the evening of Nov 20 were
 * still "today" at 1:35 AM on Nov 21 and were added to the next morning's
 * drink. These tests pin the day boundary to the member's local date, in
 * both the JS check and the SQL guard that actually performs the reset.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_TIME_ZONE,
  dayRolledOver,
  localDayKey,
  requestTimeZone,
  timeZoneMiddleware,
  validTimeZone,
  withTimeZone,
} from "../requestTimeZone";

const NY = "America/New_York";
const at = (iso: string) => new Date(iso);

describe("the member's local date", () => {
  it("Eastern: 7 PM is still the same day; one minute past midnight is the next", () => {
    // Nov 20, 8:43 PM Eastern (the founder's first water) and 11:59 PM.
    expect(localDayKey(at("2026-11-21T01:43:00Z"), NY)).toBe("2026-11-20");
    expect(localDayKey(at("2026-11-21T04:59:00Z"), NY)).toBe("2026-11-20");
    // Nov 21, 12:01 AM Eastern.
    expect(localDayKey(at("2026-11-21T05:01:00Z"), NY)).toBe("2026-11-21");
  });

  it("no reset at 7 PM Eastern, which is midnight UTC", () => {
    const loggedAt = at("2026-11-20T23:30:00Z"); // 6:30 PM Eastern
    const after7pm = at("2026-11-21T00:30:00Z"); // 7:30 PM Eastern
    expect(dayRolledOver(loggedAt, after7pm, NY)).toBe(false);
    // The old rule did reset here.
    expect(dayRolledOver(loggedAt, after7pm, "UTC")).toBe(true);
  });

  it("resets across local midnight: 11:59 PM to 12:01 AM", () => {
    expect(dayRolledOver(at("2026-11-21T04:59:00Z"), at("2026-11-21T05:01:00Z"), NY)).toBe(true);
  });

  it("the founder's case: evening drinks are not today's the next morning", () => {
    const evening = at("2026-11-21T03:52:00Z"); // Nov 20, 10:52 PM Eastern
    expect(dayRolledOver(evening, at("2026-11-21T06:35:00Z"), NY)).toBe(true); // 1:35 AM
    expect(dayRolledOver(evening, at("2026-11-21T16:43:00Z"), NY)).toBe(true); // 11:43 AM
    // Under the old rule neither moment was a new day, so 92 oz carried over.
    expect(dayRolledOver(evening, at("2026-11-21T16:43:00Z"), "UTC")).toBe(false);
  });

  it("holds east of UTC and across a daylight-saving change", () => {
    expect(dayRolledOver(at("2026-11-20T14:59:00Z"), at("2026-11-20T15:01:00Z"), "Asia/Tokyo")).toBe(true);
    // US clocks go back on Nov 1, 2026: 11:30 PM EDT to 12:30 AM EDT is one midnight.
    expect(dayRolledOver(at("2026-11-01T03:30:00Z"), at("2026-11-01T04:30:00Z"), NY)).toBe(true);
    expect(dayRolledOver(at("2026-11-01T05:30:00Z"), at("2026-11-01T06:30:00Z"), NY)).toBe(false);
  });
});

describe("the zone a request may send", () => {
  it("accepts real zone names and nothing else", () => {
    expect(validTimeZone(NY)).toBe(NY);
    expect(validTimeZone("UTC")).toBe("UTC");
    expect(validTimeZone("America/Argentina/Buenos_Aires")).toBe("America/Argentina/Buenos_Aires");
    for (const bad of ["", "Mars/Olympus", "America/New_York'; DROP TABLE x;--", "EST5EDT; select 1", 5, undefined, ["a"], "x".repeat(80)]) {
      expect(validTimeZone(bad)).toBeNull();
    }
  });

  it("a request with no zone, or a bad one, is treated as UTC, as before", () => {
    const run = (header: unknown) => {
      let seen = "";
      timeZoneMiddleware({ headers: { "x-aforce-time-zone": header } } as never, {} as never, () => {
        seen = requestTimeZone();
      });
      return seen;
    };
    expect(run(NY)).toBe(NY);
    expect(run(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(run("not a zone")).toBe(DEFAULT_TIME_ZONE);
    expect(requestTimeZone()).toBe(DEFAULT_TIME_ZONE);
    expect(withTimeZone(NY, requestTimeZone)).toBe(NY);
  });
});

describe("the SQL guard that performs the reset agrees with the JS check", () => {
  const db = new PGlite();
  beforeAll(async () => {
    await db.exec("CREATE TABLE s (id int primary key, updated_at timestamptz not null)");
  });
  /** The same expression `applyDayRollover` uses, with the clock passed in. */
  const stale = async (updatedAt: string, now: string, zone: string) => {
    await db.query("DELETE FROM s");
    await db.query("INSERT INTO s VALUES (1, $1::timestamptz)", [updatedAt]);
    const r = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM s WHERE (updated_at AT TIME ZONE $1)::date < ($2::timestamptz AT TIME ZONE $1)::date",
      [zone, now],
    );
    return r.rows[0]!.n === 1;
  };

  it.each([
    ["2026-11-20T23:30:00Z", "2026-11-21T00:30:00Z", NY],
    ["2026-11-21T04:59:00Z", "2026-11-21T05:01:00Z", NY],
    ["2026-11-21T03:52:00Z", "2026-11-21T16:43:00Z", NY],
    ["2026-11-21T03:52:00Z", "2026-11-21T16:43:00Z", "UTC"],
    ["2026-11-20T23:30:00Z", "2026-11-21T00:30:00Z", "UTC"],
    ["2026-11-20T14:59:00Z", "2026-11-20T15:01:00Z", "Asia/Tokyo"],
  ])("%s → %s in %s", async (updatedAt, now, zone) => {
    expect(await stale(updatedAt, now, zone)).toBe(dayRolledOver(at(updatedAt), at(now), zone));
  });

  it("the reset uses that expression, with the request's zone as a parameter", () => {
    const src = readFileSync(resolve(__dirname, "..", "aforceState.ts"), "utf8");
    expect(src).toContain("(${aforceUserState.updatedAt} AT TIME ZONE ${zone})::date < (now() AT TIME ZONE ${zone})::date");
    expect(src).toContain("const zone = requestTimeZone();");
    expect(src).not.toMatch(/utcDayKey|date_trunc\('day', now\(\) AT TIME ZONE 'UTC'\)/);
  });
});

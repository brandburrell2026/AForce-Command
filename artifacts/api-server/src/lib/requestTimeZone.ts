/**
 * The member's time zone for the request being handled.
 *
 * The app sends its IANA zone name on every request. It is used for one
 * thing: deciding when the member's day turns over, so "today" ends at their
 * midnight and not at midnight UTC. It is not stored, not logged, and never
 * leaves the request.
 *
 * A request with no usable zone (an older build, or anything else) reads as
 * UTC, which is exactly how the server behaved before this existed.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";

export const TIME_ZONE_HEADER = "x-aforce-time-zone";
export const DEFAULT_TIME_ZONE = "UTC";

const store = new AsyncLocalStorage<string>();

/**
 * A zone name this server and Postgres will both accept, or null. The shape
 * check keeps anything that is not a plain zone name out of SQL parameters
 * and logs; `Intl` then confirms the zone exists.
 */
export function validTimeZone(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const zone = name.trim();
  if (zone.length === 0 || zone.length > 64) return null;
  if (zone !== "UTC" && !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2}$/.test(zone)) return null;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

export function timeZoneMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const zone = validTimeZone(req.headers[TIME_ZONE_HEADER]) ?? DEFAULT_TIME_ZONE;
  store.run(zone, next);
}

/** The zone for the request in progress; UTC outside a request. */
export function requestTimeZone(): string {
  return store.getStore() ?? DEFAULT_TIME_ZONE;
}

/** Runs `fn` as if a request from `zone` were in progress. For tests. */
export function withTimeZone<T>(zone: string, fn: () => T): T {
  return store.run(validTimeZone(zone) ?? DEFAULT_TIME_ZONE, fn);
}

/** The calendar date at `instant` in `zone`, as "YYYY-MM-DD". */
export function localDayKey(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: validTimeZone(zone) ?? DEFAULT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** True when `last` and `now` fall on different calendar dates for a member in `zone`. */
export function dayRolledOver(last: Date, now: Date, zone: string): boolean {
  return localDayKey(last, zone) !== localDayKey(now, zone);
}

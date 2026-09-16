/**
 * Feature flags + kill switches. In production these flow from a remote
 * config service (LaunchDarkly / Statsig / a Postgres table watched via
 * Redis pub/sub) and are hot-reloaded without a deploy.
 *
 * The local map is the safe default — what every flag is when the remote
 * config service is unreachable.
 */

export type FlagKey =
  | 'kill.ai_router'
  | 'kill.competition_writes'
  | 'kill.scan_recognition'
  | 'kill.voice_overlay'
  | 'degrade.home_payload'
  | 'feature.team_share_cards'
  | 'feature.heat_save_share'
  // Trainer surface (Phase 1). Default OFF: the routes 404 until a founder
  // decision turns them on, which is also what a non-member sees.
  | 'feature.trainer_api';

const DEFAULTS: Record<FlagKey, boolean> = {
  'kill.ai_router':           false,
  'kill.competition_writes':  false,
  'kill.scan_recognition':    false,
  'kill.voice_overlay':       false,
  'degrade.home_payload':     false,
  'feature.team_share_cards': false,
  'feature.heat_save_share':  true,
  'feature.trainer_api':      false,
};

const overrides = new Map<FlagKey, boolean>();

/**
 * ENVIRONMENT OVERRIDES — the kill switch that actually exists today.
 *
 * `setFlag` is the hot-reload entry point and has no production caller: no
 * remote config service is wired up, so until one is, a flag could only be
 * changed by editing this file and deploying. For a surface carrying medical
 * records that is not good enough — "turn it off" has to be something an
 * operator can do in minutes, under pressure, without a code review.
 *
 * `AFORCE_FLAGS` is one environment variable holding a comma-separated list:
 *
 *     AFORCE_FLAGS="feature.trainer_api=true,kill.ai_router=true"
 *
 * One variable rather than one per flag, so an operator has a single place to
 * look and a single thing to change. It takes effect on restart, which on
 * this host is seconds and does not require a deploy.
 *
 * PRECEDENCE, highest first:
 *   1. `setFlag` — a live hot-reload, when something is wired to call it
 *   2. `AFORCE_FLAGS` — the operator's switch
 *   3. `DEFAULTS` — the safe value, which is what applies if the variable is
 *      absent, malformed, or names something that is not a flag
 *
 * FAILS CLOSED, ENTRY BY ENTRY. An unrecognised key or an unparseable value
 * is ignored and the default stands; one bad entry does not discard the rest
 * of the list, and nothing here can turn a flag on by accident. Only the
 * literal strings "true" and "false" are values — "1", "yes" and "on" are
 * not, because a flag that means something different from what its author
 * typed is worse than one that did not apply.
 */
const ENV_VAR = "AFORCE_FLAGS";

let envCacheKey: string | undefined;
let envCache: Partial<Record<FlagKey, boolean>> = {};

function envOverrides(): Partial<Record<FlagKey, boolean>> {
  const raw = process.env[ENV_VAR] ?? "";
  // Re-parsed only when the variable itself changes, so `isEnabled` stays
  // cheap on a hot path while still picking up a change made after import.
  if (raw === envCacheKey) return envCache;

  const parsed: Partial<Record<FlagKey, boolean>> = {};
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();

    if (!(key in DEFAULTS)) continue;
    if (value !== "true" && value !== "false") continue;
    parsed[key as FlagKey] = value === "true";
  }

  envCacheKey = raw;
  envCache = parsed;
  return parsed;
}

export function isEnabled(key: FlagKey): boolean {
  if (overrides.has(key)) return overrides.get(key)!;
  const fromEnv = envOverrides()[key];
  return fromEnv ?? DEFAULTS[key];
}

/** Where each flag's current value came from. For the ops endpoint. */
export function flagSources(): Record<FlagKey, "override" | "env" | "default"> {
  const env = envOverrides();
  const out = {} as Record<FlagKey, "override" | "env" | "default">;
  for (const key of Object.keys(DEFAULTS) as FlagKey[]) {
    out[key] = overrides.has(key) ? "override" : key in env ? "env" : "default";
  }
  return out;
}

/** Hot-reload entry point — Redis pub/sub handler calls this on flag change. */
export function setFlag(key: FlagKey, value: boolean): void {
  overrides.set(key, value);
}

export function snapshot(): Record<FlagKey, boolean> {
  const out = { ...DEFAULTS };
  const env = envOverrides();
  (Object.keys(env) as FlagKey[]).forEach((k) => { out[k] = env[k]!; });
  overrides.forEach((v, k) => { out[k] = v; });
  return out;
}

/** TEST-ONLY: drop hot-reload overrides and the parsed environment cache. */
export function __resetFlagsForTests(): void {
  overrides.clear();
  envCacheKey = undefined;
  envCache = {};
}

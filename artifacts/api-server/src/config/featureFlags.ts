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
  | 'feature.heat_save_share';

const DEFAULTS: Record<FlagKey, boolean> = {
  'kill.ai_router':           false,
  'kill.competition_writes':  false,
  'kill.scan_recognition':    false,
  'kill.voice_overlay':       false,
  'degrade.home_payload':     false,
  'feature.team_share_cards': false,
  'feature.heat_save_share':  true,
};

const overrides = new Map<FlagKey, boolean>();

export function isEnabled(key: FlagKey): boolean {
  return overrides.has(key) ? overrides.get(key)! : DEFAULTS[key];
}

/** Hot-reload entry point — Redis pub/sub handler calls this on flag change. */
export function setFlag(key: FlagKey, value: boolean): void {
  overrides.set(key, value);
}

export function snapshot(): Record<FlagKey, boolean> {
  const out = { ...DEFAULTS };
  overrides.forEach((v, k) => { out[k] = v; });
  return out;
}

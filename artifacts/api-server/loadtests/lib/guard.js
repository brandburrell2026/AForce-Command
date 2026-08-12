// Environment safety guard shared by every load-test tier.
//
// Rule (Wave-4 Part 13, founder directive): destructive or heavy load runs
// against SAFE environments only. Production may receive at most the tier-1
// read-only smoke; tier-2/3, soak, and recovery scenarios refuse to start
// when BASE_URL points at a production host.
//
// FAIL-CLOSED: k6's runtime has no `URL` constructor, so the host is parsed
// with a regex — and an unparseable BASE_URL aborts the run rather than
// slipping past the guard. (v1 of this file used `new URL()` in a try/catch
// that returned '' — the guard silently failed OPEN. Never again.)

export const PRODUCTION_HOSTS = [
  'aforce-command-production.up.railway.app',
  'api.drinkaforce.com',
  'www.drinkaforce.com',
  'drinkaforce.com',
];

export function hostOf(baseUrl) {
  const m = /^https?:\/\/([^/:?#]+)/i.exec(String(baseUrl).trim());
  return m ? m[1].toLowerCase() : '';
}

export function isProductionHost(baseUrl) {
  return PRODUCTION_HOSTS.includes(hostOf(baseUrl));
}

/**
 * Abort the run unless the target is a safe (non-production) environment.
 * k6 setup() throwing kills the whole run before any VU starts.
 */
export function assertSafeEnvironment(baseUrl, tierName) {
  const host = hostOf(baseUrl);
  if (!host) {
    throw new Error(
      `${tierName}: cannot parse BASE_URL "${baseUrl}" — refusing to run (guard fails closed).`,
    );
  }
  if (PRODUCTION_HOSTS.includes(host)) {
    throw new Error(
      `${tierName} is not permitted against production host "${host}". ` +
        'Point BASE_URL at staging or a local/Docker instance. ' +
        'Only k6-tier1-smoke.js (read-only) may target production.',
    );
  }
}

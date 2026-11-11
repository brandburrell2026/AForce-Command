/**
 * Telemetry boundary for Gentle Hydration. The allowlist is intentionally empty:
 * no event, diagnostic payload, breadcrumb, or remote-config value may carry
 * its state, its copy, or GLP-related context.
 */
export const GENTLE_HYDRATION_TELEMETRY_ALLOWLIST: readonly string[] = [];
const FORBIDDEN =
  /gentle[ _-]?hydration|glp(?:[ _-]?1)?|pauseStreakDisplay|promptsEnabled/i;

export function isGentleHydrationTelemetry(value: unknown): boolean {
  try {
    return FORBIDDEN.test(JSON.stringify(value));
  } catch {
    return true;
  }
}

/** Drop, rather than sanitize, any payload that violates the boundary. */
export function mayEmitAnalytics(eventType: string, payload: unknown): boolean {
  return (
    GENTLE_HYDRATION_TELEMETRY_ALLOWLIST.includes(eventType) ||
    !isGentleHydrationTelemetry({ eventType, payload })
  );
}

/**
 * Social — bottom-tab entry for the spec-driven Social V2 screen.
 *
 * Renders only the five approved blocks: Signal, Command, Forecast,
 * Session Memory, Crew. Engine internals (Recovery Capacity score,
 * decay multiplier, current band, cruise timer, Extend Cruise,
 * Shield Locked, End Session) are computed by the social slice but
 * never surfaced here.
 *
 * The legacy Recovery/Cruise UI is preserved at
 * `app/(tabs)/social-legacy.tsx` and only appears in the tab bar
 * when Developer Mode is enabled (see `services/devMode.ts` +
 * Profile → Settings → Developer).
 */
export { default } from '@/screens/SocialModeV2Screen';

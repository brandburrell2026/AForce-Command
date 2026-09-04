/**
 * WHO THIS BUILD IS, for the server's version telemetry.
 *
 * `<platform>/<appVersion>+<build>` — e.g. `ios/1.0.0+71`. The server parses
 * this with `api-server/src/lib/clientVersion.ts`, and a cross-package law
 * proves the two agree rather than trusting that they do.
 *
 * ── THE BUILD NUMBER MUST COME FROM THE NATIVE BUNDLE ────────────────────
 *
 * NOT from `Constants.expoConfig`. That reflects `app.json`, where
 * `ios.buildNumber` is still "1" and `android.versionCode` is still 1 — while
 * the artifact actually shipped to TestFlight is build **71**. Reading the
 * config would report every iOS build as 1 and make the whole telemetry
 * useless at exactly the moment it mattered.
 *
 * `nativeAppVersion` / `nativeBuildVersion` read the real bundle. They are
 * marked deprecated in favour of `expo-application`, which is present in the
 * tree only transitively and is not a declared dependency of this app —
 * adding a native module to the dependency set is a separate decision, so the
 * declared path is used and the deprecation is accepted deliberately.
 *
 * ── AND IT NEVER THROWS ─────────────────────────────────────────────────
 *
 * Anything missing or unexpected returns `null`, which sends no header, which
 * the server reads as `unknown`, which never blocks. Identifying yourself is a
 * courtesy to the server; failing to is not an error the member should feel.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Matches the server's grammar exactly; anything else is not sent. */
const APP_VERSION_RE = /^[0-9A-Za-z.\-]{1,32}$/;

export function buildClientIdentityHeader(
  platformOS: string = Platform.OS,
  appVersion: string | null = Constants.nativeAppVersion ?? null,
  buildVersion: string | null = Constants.nativeBuildVersion ?? null,
): string | null {
  if (platformOS !== 'ios' && platformOS !== 'android') return null;
  if (typeof appVersion !== 'string' || !APP_VERSION_RE.test(appVersion)) return null;
  if (typeof buildVersion !== 'string') return null;
  // Android exposes versionCode, iOS CFBundleVersion. Both must read as a
  // plain non-negative integer; an iOS project configured with a dotted
  // CFBundleVersion ("1.2.3") has no monotonic number to send, so it sends
  // nothing rather than something the server would have to guess about.
  if (!/^\d{1,10}$/.test(buildVersion)) return null;
  const build = Number(buildVersion);
  if (!Number.isSafeInteger(build) || build < 0) return null;
  return `${platformOS}/${appVersion}+${build}`;
}

/** The header name. Lowercase because that is how it is read server-side. */
export const CLIENT_HEADER_NAME = 'x-aforce-client';

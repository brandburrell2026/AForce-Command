/**
 * NO-c native-evidence enabler — deterministic internal-route synchronization.
 *
 * The internal route source lives OUTSIDE `app/`. This module GENERATES
 * `app/internal-preview.tsx` (a thin re-export of the internal route) ONLY for the
 * `internal-native` build, and DELETES it for every other profile — idempotently,
 * failing closed. It runs before Expo Router route discovery / bundling (invoked
 * from `app.config.ts`), so a production build never registers or bundles the
 * internal route. `.gitignore` is NOT the security boundary — this sync is.
 *
 * Pure Node/fs; `appDir` is injectable so the behavior is unit-tested against a
 * temp directory.
 */
import { existsSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const GENERATED_ROUTE_FILENAME = 'internal-preview.tsx';

/** Unmistakable generated-file header — grep-able + warns against manual edits/commits. */
export const GENERATED_HEADER =
  '// @generated AFORCE-INTERNAL-PREVIEW-ROUTE — DO NOT EDIT OR COMMIT.\n' +
  '// Created ONLY by internal-preview/routeSync.mjs for the internal-native build,\n' +
  '// and DELETED for every other profile. Never ships in production.\n';

/** The exact content of the generated route (thin re-export of the internal source). */
export function generatedRouteContent() {
  return GENERATED_HEADER + "export { default } from '@/internal-preview/internalPreviewRoute';\n";
}

/**
 * Idempotently synchronize the generated route for a build `variant`.
 * - 'internal'  → create/replace the generated route from the approved source.
 * - otherwise   → delete the generated route if present; VERIFY it is gone; throw
 *                 (fail closed) if deletion or verification cannot complete.
 * Returns { action, targetPath }.
 */
export function syncInternalPreviewRoute({ variant, appDir }) {
  const targetPath = join(appDir, GENERATED_ROUTE_FILENAME);
  const exists = existsSync(targetPath);

  if (variant === 'internal') {
    const content = generatedRouteContent();
    // idempotent: only write when missing or drifted
    if (!exists || readFileSync(targetPath, 'utf8') !== content) {
      writeFileSync(targetPath, content, 'utf8');
    }
    return { action: exists ? 'refreshed' : 'created', targetPath };
  }

  // Any non-internal profile MUST NOT carry the generated route forward.
  if (exists) {
    rmSync(targetPath, { force: true });
  }
  if (existsSync(targetPath)) {
    // Deletion/verification failed — fail the (production) build rather than fall back.
    throw new Error(
      `[internal-preview] refused: generated internal route still present after cleanup at ${targetPath}`,
    );
  }
  return { action: exists ? 'deleted' : 'absent', targetPath };
}

/** Assert no generated internal route is present (used by production build/CI guards). */
export function assertNoGeneratedRoute({ appDir }) {
  const targetPath = join(appDir, GENERATED_ROUTE_FILENAME);
  if (existsSync(targetPath)) {
    throw new Error(`[internal-preview] production build refused: ${targetPath} must not exist`);
  }
}

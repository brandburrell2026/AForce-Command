/**
 * Fills the iOS submit placeholders in artifacts/aforce-os/eas.json
 * from two env vars so the user never hand-edits the JSON.
 *
 * Usage:
 *   EAS_ASC_APP_ID=1234567890 \
 *   EAS_APPLE_TEAM_ID=ABCDE12345 \
 *   pnpm --filter @workspace/scripts run eas-configure-submit
 *
 * Idempotent: re-running with the same values is a no-op.
 * Refuses to write empty / placeholder strings.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve relative to THIS file (scripts/src/), not process.cwd() —
// pnpm --filter changes cwd to the package dir, so a cwd-based path
// would ENOENT. From scripts/src/ → ../../artifacts/aforce-os/eas.json
const HERE = dirname(fileURLToPath(import.meta.url));
const EAS_PATH = resolve(HERE, '../../artifacts/aforce-os/eas.json');

const PLACEHOLDER_ASC = 'REPLACE_WITH_APP_STORE_CONNECT_APP_ID';
const PLACEHOLDER_TEAM = 'REPLACE_WITH_APPLE_TEAM_ID';

const ascAppId = process.env['EAS_ASC_APP_ID']?.trim();
const appleTeamId = process.env['EAS_APPLE_TEAM_ID']?.trim();

if (!ascAppId || !appleTeamId) {
  console.error(
    'Missing env vars. Run with:\n' +
      '  EAS_ASC_APP_ID=<numeric ASC app id> \\\n' +
      '  EAS_APPLE_TEAM_ID=<10-char Apple Team ID> \\\n' +
      '  pnpm --filter @workspace/scripts run eas-configure-submit',
  );
  process.exit(1);
}
if (ascAppId === PLACEHOLDER_ASC || appleTeamId === PLACEHOLDER_TEAM) {
  console.error('Refusing to write placeholder values back into eas.json.');
  process.exit(1);
}
if (!/^[0-9]+$/.test(ascAppId)) {
  console.error(`EAS_ASC_APP_ID must be numeric, got: ${ascAppId}`);
  process.exit(1);
}
if (!/^[A-Z0-9]{10}$/.test(appleTeamId)) {
  console.error(`EAS_APPLE_TEAM_ID must be 10 uppercase alphanumeric chars, got: ${appleTeamId}`);
  process.exit(1);
}

const raw = await readFile(EAS_PATH, 'utf8');
const eas = JSON.parse(raw) as {
  submit?: { production?: { ios?: { ascAppId?: string; appleTeamId?: string } } };
};

eas.submit ??= {};
eas.submit.production ??= {};
eas.submit.production.ios ??= {};
const before = { ...eas.submit.production.ios };
eas.submit.production.ios.ascAppId = ascAppId;
eas.submit.production.ios.appleTeamId = appleTeamId;

if (before.ascAppId === ascAppId && before.appleTeamId === appleTeamId) {
  console.log('eas.json already configured with these values — no change.');
  process.exit(0);
}

await writeFile(EAS_PATH, JSON.stringify(eas, null, 2) + '\n', 'utf8');
console.log(`eas.json updated:\n  submit.production.ios.ascAppId    = ${ascAppId}\n  submit.production.ios.appleTeamId = ${appleTeamId}`);

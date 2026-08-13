/**
 * Prove which Clerk instance the deployed api-server actually validates against.
 *
 * WHY THIS EXISTS. `client Clerk instance == server Clerk instance` is the one
 * real rule (see artifacts/aforce-os/lib/__tests__/clerkInstancePairing.test.ts),
 * but CI cannot read Railway's environment, so the server half is a declared
 * constant. This script is what keeps that declaration honest. Run it whenever
 * the server's Clerk configuration changes, then update SERVER_CLERK_INSTANCE in
 * the guard to match what this prints.
 *
 * It exists because a secondhand reading of the server's secret — "it's sk_live_"
 * — was taken as evidence once, and it was wrong. That misreading moved the
 * client onto an unrelated Clerk application and produced the Build 63/64 black
 * screen. Configuration claims need a machine to confirm them.
 *
 * USAGE
 *   railway run --service AForce-Command node scripts/verify-clerk-pairing.mjs
 *
 * SECRET DISCIPLINE. The secret is used only as an Authorization header inside
 * this process. It is never printed, logged, written to disk, or returned. Only
 * the key PREFIX (`sk_live_` / `sk_test_`) and instance identity are shown, and
 * the only request made is a GET.
 */
const pk = process.env.CLERK_PUBLISHABLE_KEY ?? '';
const sk = process.env.CLERK_SECRET_KEY ?? '';

function decodeHost(key) {
  const payload = key.replace(/^pk_(test|live)_/, '');
  try {
    const d = Buffer.from(
      payload + '='.repeat((4 - (payload.length % 4)) % 4),
      'base64',
    ).toString('utf8');
    return d.replace(/\$$/, '').trim();
  } catch {
    return '(undecodable)';
  }
}

console.log('DEPLOYMENT');
console.log('  project     :', process.env.RAILWAY_PROJECT_NAME ?? '(not on Railway)');
console.log('  environment :', process.env.RAILWAY_ENVIRONMENT_NAME ?? '(unknown)');
console.log('  service     :', process.env.RAILWAY_SERVICE_NAME ?? '(unknown)');
console.log('  public host :', process.env.RAILWAY_PUBLIC_DOMAIN ?? '(unknown)');

console.log('\nSERVER CLERK CONFIGURATION');
console.log('  publishable prefix :', pk ? pk.slice(0, 8) : '(unset)');
console.log('  publishable decodes:', pk ? decodeHost(pk) : '(unset)');
console.log('  secret prefix      :', sk ? sk.slice(0, 8) : '(unset)');

if (!sk) {
  console.log('\nNo CLERK_SECRET_KEY present — the server cannot verify any token.');
  process.exit(1);
}

// Authoritative: ask Clerk which instance this secret belongs to. Read-only.
const res = await fetch('https://api.clerk.com/v1/domains', {
  headers: { Authorization: `Bearer ${sk}` },
});

if (!res.ok) {
  // Never echo the response body blindly; it can carry request context.
  console.log(`\nClerk rejected the secret (HTTP ${res.status}). It is not valid for this instance.`);
  process.exit(1);
}

const body = await res.json();
const rows = Array.isArray(body) ? body : (body.data ?? []);
const primary = rows.find((d) => !d.is_satellite) ?? rows[0];

console.log('\nAUTHORITATIVE INSTANCE (Clerk BAPI GET /v1/domains -> 200)');
for (const d of rows) {
  console.log(`  ${d.is_satellite ? 'satellite' : 'primary  '} : ${d.name}`);
  console.log('              frontend api:', d.frontend_api_url ?? '(none)');
}

const fapi = (primary?.frontend_api_url ?? '').replace(/^https?:\/\//, '');
console.log('\n=> SERVER_CLERK_INSTANCE =', fapi || '(could not determine)');
console.log(
  '   Set this exact value in artifacts/aforce-os/lib/__tests__/clerkInstancePairing.test.ts',
);
if (sk.startsWith('sk_test_')) {
  console.log(
    '\n   NOTE: this is a Clerk DEVELOPMENT instance. Acceptable for internal QA only —\n' +
      '   development instances carry relaxed security, short sessions and hard rate limits.\n' +
      '   Public beta is BLOCKED on this. See governance/PRODUCTION-CLERK-MIGRATION-PLAN.md.',
  );
}

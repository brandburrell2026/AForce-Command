#!/usr/bin/env bash
# Mutation matrix for the client analytics transition lane.
#
# Each mutant patches ONE safety boundary in the production source, runs the law
# suites, and records KILLED (the laws went red) or MISSED (they passed anyway).
# A MISSED mutant means the boundary is not actually proven.
#
# Harness note, learned the hard way in the PG18 lane: capture the exit code
# FIRST. Any command in between — including `local` — resets $?.
set -uo pipefail

REPO="/Users/brandonburrell/AForce-Command"
APP="$REPO/artifacts/aforce-os"
AUTH="$APP/analytics/consentAuthority.ts"
DISP="$APP/analytics/event_dispatcher.ts"
PRIV="$APP/analytics/privacy_manager.ts"

SUITES=(
  "artifacts/aforce-os/analytics/__tests__/clientAnalyticsTransition.test.ts"
  "artifacts/aforce-os/analytics/__tests__/analyticsIdentityIsolation.test.ts"
  "artifacts/aforce-os/analytics/__tests__/event_dispatcher.territory.test.ts"
  "artifacts/aforce-os/analytics/__tests__/event_dispatcher.firstWin.test.ts"
  "artifacts/aforce-os/analytics/__tests__/event_dispatcher.perfAge.test.ts"
  "artifacts/aforce-os/analytics/__tests__/event_dispatcher.receiptScanned.test.ts"
)

BACKUP_DIR=$(mktemp -d)
cp "$AUTH" "$BACKUP_DIR/auth.ts"
cp "$DISP" "$BACKUP_DIR/disp.ts"
cp "$PRIV" "$BACKUP_DIR/priv.ts"
restore() {
  cp "$BACKUP_DIR/auth.ts" "$AUTH"
  cp "$BACKUP_DIR/disp.ts" "$DISP"
  cp "$BACKUP_DIR/priv.ts" "$PRIV"
}
trap 'restore; rm -rf "$BACKUP_DIR"' EXIT

run_suites() {
  ( cd "$REPO" && ./node_modules/.bin/vitest run "${SUITES[@]}" >/tmp/mut.out 2>&1 )
  # FIRST statement after the subshell. Nothing may intervene.
  rc=$?
  return $rc
}

PASS=0
FAIL=0

check() {
  id="$1"; desc="$2"
  if [ "${MUTANT_APPLIED:-1}" -ne 0 ]; then
    printf '  %-5s ERROR    patch did not apply — %s\n' "$id" "$desc"
    FAIL=$((FAIL + 1))
    restore
    return
  fi
  run_suites
  rc=$?
  if [ "$rc" -ne 0 ]; then
    printf '  %-5s KILLED   %s\n' "$id" "$desc"
    PASS=$((PASS + 1))
  else
    printf '  %-5s MISSED   %s\n' "$id" "$desc"
    FAIL=$((FAIL + 1))
    grep -E "Tests +[0-9]+ passed" /tmp/mut.out | tail -1
  fi
  restore
}

echo "── positive control (unmutated source must be GREEN) ──"
run_suites
rc=$?
if [ "$rc" -ne 0 ]; then
  echo "  ABORT: the suites are red BEFORE any mutation. Every MISSED below"
  echo "  would be meaningless and every KILLED would be a false positive."
  tail -30 /tmp/mut.out
  exit 1
fi
echo "  OK — baseline green"
echo
echo "── mutants ──"

# M1 · re-introduce a local mint.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""  if (!effectiveGranted(adopted, pending)) return null;
  return serverId;""",
"""  if (!effectiveGranted(adopted, pending)) return null;
  return serverId ?? `anon_local_${userIdOrBlank()}`;""",1)
s=s.replace("""export async function resolveEmissionIdentity(): Promise<string | null> {
  if (currentMemberId() === null) return null;""",
"""function userIdOrBlank(): string { return currentMemberId() ?? 'x'; }
export async function resolveEmissionIdentity(): Promise<string | null> {
  if (currentMemberId() === null) return null;""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M1 "client mints an id locally when the server has not issued one"

# M2 · drop the consent half of the emission gate.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""  if (!effectiveGranted(adopted, pending)) return null;
  return serverId;""","""  return serverId;""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M2 "emission gate ignores consent and returns the id regardless"

# M3 · drop the server-id half of the emission gate.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""  if (!effectiveGranted(adopted, pending)) return null;
  return serverId;""",
"""  if (!effectiveGranted(adopted, pending)) return null;
  return serverId ?? 'anon_placeholder_0000';""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M3 "emission proceeds with a placeholder id"

# M4 · the ceiling no longer restricts: pure server renderer.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""  if (pending?.action === 'revoke') return false;
  return adopted?.granted === true;""","""  return adopted?.granted === true;""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M4 "pending revoke no longer restricts (client is a pure renderer)"

# M5 · the ceiling becomes SYMMETRIC: a pending grant opens collection.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""  if (pending?.action === 'revoke') return false;
  return adopted?.granted === true;""",
"""  if (pending?.action === 'revoke') return false;
  if (pending?.action === 'grant') return true;
  return adopted?.granted === true;""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M5 "unconfirmed offline GRANT opens collection"

# M6 · the revoke ceiling goes up only AFTER a disk read.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""export function recordDecision(action: ConsentAction): Promise<DecisionOutcome> {
  const userId = currentMemberId();
  if (userId === null) return Promise.resolve({ outcome: 'not_a_member' });""",
"""export function recordDecision(action: ConsentAction): Promise<DecisionOutcome> {
  const userId = currentMemberId();
  if (userId === null) return Promise.resolve({ outcome: 'not_a_member' });
  return hydrate().then(() => recordDecisionAfterHydrate(action, userId));
}
function recordDecisionAfterHydrate(
  action: ConsentAction,
  userId: string,
): Promise<DecisionOutcome> {""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M6 "the ceiling is applied only after an await (not synchronously)"

# M7 · the pending record loses its per-member suffix.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""const pendingKey = (userId: string): string => `${PENDING_KEY_PREFIX}.${userId}`;""",
"""const pendingKey = (_userId: string): string => PENDING_KEY_PREFIX;""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M7 "pending decision is stored under one device-global key"

# M8 · the server-id cache loses its per-member suffix.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""const serverIdKey = (userId: string): string => `${SERVER_ID_KEY_PREFIX}.${userId}`;""",
"""const serverIdKey = (_userId: string): string => SERVER_ID_KEY_PREFIX;""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M8 "server pseudonym cached under one device-global key"

# M9 · the account-switch barrier after the identity round trip is removed.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""  const res = await resolveIdentityOverWire();
  if (!scopeTokenStillValid(token)) return; // account switched mid-flight""",
"""  const res = await resolveIdentityOverWire();""",1)
assert "const res = await resolveIdentityOverWire();\n  if (!scopeTokenStillValid" not in s, "M9 anchor did not apply"
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M9 "W4 barrier removed after the identity resolve"

# M10 · the scope-change reset is removed.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""subscribeScopeState(() => {
  resetForScopeChange();
  notify();
});""","""subscribeScopeState(() => {
  notify();
});""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M10 "account switch no longer drops the previous member's state"

# M10b · the reset regresses to subscribeUserScope, which never fires flag-off.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("subscribeScopeState }","subscribeUserScope }",1)
s=s.replace("import { getScopeState, getUserScopeGeneration, subscribeScopeState } from '@/services/userScope';",
            "import { getScopeState, getUserScopeGeneration, subscribeUserScope } from '@/services/userScope';",1)
s=s.replace("""subscribeScopeState(() => {""","""subscribeUserScope(() => {""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M10b "reset listens on subscribeUserScope (inert while isolation is off)"

# M11 · a 401 is classified terminal.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""  if (status === 401) return 'transient';""","""  if (status === 401) return 'terminal';""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M11 "temporary session loss (401) treated as terminal"

# M12 · every 4xx is classified transient — the infinite-retry mutant.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""  if (status >= 400 && status < 500) return 'terminal';
  return 'transient';""","""  return 'transient';""",1)
s=s.replace("""  if (code !== null && TERMINAL_CODES.has(code)) return 'terminal';""",
            """  if (false && code !== null && TERMINAL_CODES.has(code)) return 'terminal';""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M12 "a permanent refusal is classified transient (retries forever)"

# M13 · reconcile revives needs_resolution automatically.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""    if (p.state === 'needs_resolution') return;
    if (conflictSatisfiesIntent(p.action, adopted)) {""",
"""    if (conflictSatisfiesIntent(p.action, adopted)) {""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M13 "needs_resolution is auto-retried by reconcile"

# M14 · the conflict re-issue bound is removed.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""      if (inflight.reissues >= MAX_CONFLICT_REISSUES) {
        await markNeedsResolution(userId, token);
        notify();
        return;
      }""","",1)
s=s.replace("""  for (let attempt = 0; attempt <= MAX_CONFLICT_REISSUES; attempt += 1) {""",
            """  for (let attempt = 0; attempt <= 50; attempt += 1) {""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M14 "conflict re-issues are unbounded"

# M15 · a never-decided server row satisfies an explicit revoke.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""  if (current.decisionSeq === null) return false;""","",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M15 "an explicit revoke is dropped as redundant against a never-asked row"

# M16 · the pending record is persisted only AFTER the response.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""    setPending(inflight);
    // Persisted BEFORE the request, so a crash mid-flight is recoverable: the
    // next launch finds an `inflight` record and re-sends it. The server's
    // compare-and-set makes that duplicate harmless.
    await savePending(userId, inflight);""","""    setPending(inflight);""",1)
s=s.replace("""async function completeDecision(
  userId: string,
  record: PendingConsentDecision,
): Promise<DecisionOutcome> {
  await savePending(userId, record);
  await reconcile();""","""async function completeDecision(
  userId: string,
  record: PendingConsentDecision,
): Promise<DecisionOutcome> {
  await reconcile();
  if (pending !== null) await savePending(userId, pending);""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M16 "the decision is persisted only after the request (crash loses it)"

# M17 · `{inserted: 0}` is treated as retryable.
python3 - "$DISP" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""    if (result.outcome === "unavailable") return; // still owed; retry later""",
"""    if (result.outcome === "unavailable") return; // still owed; retry later
    if (result.outcome === "refused") return; // MUTANT: retry a refusal forever""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M17 "a refused batch stays in the outbox and is retried forever"

# M18 · `{inserted: 0}` is counted as delivery.
python3 - "$DISP" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""    if (result.outcome === "refused") settlement.refused += batch.length;""","",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M18 "a refusal is settled silently with no count distinguishing it"

# M19 · foreign (legacy-id) envelopes are no longer filtered.
python3 - "$DISP" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""        if (e.analytics_id === analyticsId) mine.push(e);
        else foreign += 1;""","""        mine.push(e);""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M19 "legacy envelopes are sent, poisoning every batch"

# M20 · the flush account-switch barrier is removed.
python3 - "$DISP" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""    if (!scopeTokenStillValid(token)) return;
    if (result.outcome === "unavailable") return; // still owed; retry later""",
"""    if (result.outcome === "unavailable") return; // still owed; retry later""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M20 "flush settles the outbox after an account switch"

# M21 · the legacy local id is read as a fallback identity.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""async function loadServerId(userId: string): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(serverIdKey(userId));
    return v && v.length >= 8 ? v : null;""",
"""async function loadServerId(userId: string): Promise<string | null> {
  try {
    const v =
      (await AsyncStorage.getItem(serverIdKey(userId))) ??
      (await AsyncStorage.getItem('@aforce/analytics-id'));
    return v && v.length >= 8 ? v : null;""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M21 "the legacy locally-minted id is adopted as the member's pseudonym"

# M22 · a suppressed member keeps a usable pseudonym.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""    serverId = null;
    adopted = { granted: false, decisionSeq: null, disclosureVersion: null };
    await saveServerId(userId, null);""",
"""    adopted = { granted: false, decisionSeq: null, disclosureVersion: null };""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M22 "a suppressed / refused member keeps a cached pseudonym"

# M23 · hydrate overwrites a decision recorded while the disk was answering.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""      if (pendingWriteSeq === writeSeqAtStart) pending = p;""","""      pending = p;""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M23 "hydrate clobbers a newer in-memory decision with the disk value"

# M24 · NON-VACUITY: refuse everything.
python3 - "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); ORIGINAL=s
s=s.replace("""export async function resolveEmissionIdentity(): Promise<string | null> {""",
"""export async function resolveEmissionIdentity(): Promise<string | null> {
  if (true) return null; // MUTANT: collect nothing, ever""",1)
assert s != ORIGINAL, 'MUTANT DID NOT APPLY — the anchor string no longer matches the source'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M24 "the gate refuses everything (non-vacuity control)"

echo
echo "── result ──"
echo "  KILLED: $PASS    MISSED: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1

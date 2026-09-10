#!/usr/bin/env bash
# Mutation matrix for Lane 2 (client analytics remediation).
#
# Guards: every mutant asserts its patch applied; the exit code is captured as
# the FIRST statement after each run; the harness records WHICH assertion caught
# each mutant.
set -uo pipefail

REPO="/Users/brandonburrell/AForce-Command"
AUTH="$REPO/artifacts/aforce-os/analytics/consentAuthority.ts"
PRIV="$REPO/artifacts/aforce-os/analytics/privacy_manager.ts"
DISP="$REPO/artifacts/aforce-os/analytics/event_dispatcher.ts"

SUITES=(
  "artifacts/aforce-os/analytics/__tests__/clientAnalyticsRemediation.test.ts"
  "artifacts/aforce-os/analytics/__tests__/clientAnalyticsTransition.test.ts"
  "artifacts/aforce-os/analytics/__tests__/analyticsIdentityIsolation.test.ts"
  "artifacts/aforce-os/services/__tests__/storageClassification.test.ts"
)

BD=$(mktemp -d)
cp "$AUTH" "$BD/a"; cp "$PRIV" "$BD/p"; cp "$DISP" "$BD/d"
restore() { cp "$BD/a" "$AUTH"; cp "$BD/p" "$PRIV"; cp "$BD/d" "$DISP"; }
trap 'restore; rm -rf "$BD"' EXIT

run_suites() {
  ( cd "$REPO" && ./node_modules/.bin/vitest run "${SUITES[@]}" >/tmp/mut-l2.out 2>&1 )
  rc=$?
  return $rc
}
PASS=0; FAIL=0
check() {
  id="$1"; want="$2"; desc="$3"
  if [ "${MUTANT_APPLIED:-1}" -ne 0 ]; then
    printf '  %-4s ERROR    patch did not apply — %s\n' "$id" "$desc"; FAIL=$((FAIL+1)); restore; return
  fi
  run_suites
  rc=$?
  if [ "$rc" -ne 0 ]; then
    if [ -z "$want" ] || grep -qF "$want" /tmp/mut-l2.out; then
      printf '  %-4s KILLED   %s\n' "$id" "$desc"
      [ -n "$want" ] && printf '           by: "%.66s..."\n' "$want"
    else
      printf '  %-4s KILLED*  %s  (other assertion)\n' "$id" "$desc"
      grep -E "AssertionError" /tmp/mut-l2.out | sed 's/^ *//' | sort -u | head -1
    fi
    PASS=$((PASS+1))
  else
    printf '  %-4s MISSED   %s\n' "$id" "$desc"; FAIL=$((FAIL+1))
    grep -E "Tests +[0-9]+ passed" /tmp/mut-l2.out | tail -1
  fi
  restore
}

echo "── positive control ──"
run_suites
rc=$?
if [ "$rc" -ne 0 ]; then echo "  ABORT: red before mutation"; tail -30 /tmp/mut-l2.out; exit 1; fi
grep -E "Tests +[0-9]+ passed" /tmp/mut-l2.out | tail -1
echo "  OK — baseline green"; echo; echo "── mutants ──"

py() { python3 - "$@"; }

# ── E · the late-hydrate serverId guard ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("      if (serverIdWriteSeq === serverIdSeqAtStart) serverId = id;",
            "      serverId = id;",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L1 "THE state the retracted M1/M3 proof called unreachable" \
  "E — the serverId staleness guard is removed"

# ── M1 (composite) · the guard removed AND a local mint restored ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("      if (serverIdWriteSeq === serverIdSeqAtStart) serverId = id;",
            "      serverId = id;",1)
s=s.replace("  if (!effectiveGrantedNow()) return null;\n  return serverId;",
            "  if (!effectiveGrantedNow()) return null;\n  return serverId ?? `anon_local_${currentMemberId() ?? 'x'}`;",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M1 "" "M1 — local mint reachable again (E guard removed + fallback)"

# ── M3 (composite) · the guard removed AND a placeholder id ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("      if (serverIdWriteSeq === serverIdSeqAtStart) serverId = id;",
            "      serverId = id;",1)
s=s.replace("  if (!effectiveGrantedNow()) return null;\n  return serverId;",
            "  if (!effectiveGrantedNow()) return null;\n  return serverId ?? 'anon_placeholder_0000';",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check M3 "" "M3 — placeholder id reachable again (E guard removed + fallback)"

# ── C · publishPending stale-write guard ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("    if (pendingWriteSeq !== publishSeq) {","    if (false) {",1)
s=s.replace("    if (pendingWriteSeq !== publishSeq) return; // superseded before we even sent","",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L4 "the newer decision must not be erased by the older publication" \
  "C — publishPending stale-write guard removed"

# ── B · a corrupt record becomes "nothing pending" ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("    return { kind: 'unreadable', why: 'corrupt' };\n  }\n  const seq = p.basedOnSeq;",
            "    return { kind: 'absent' };\n  }\n  const seq = p.basedOnSeq;",1)
s=s.replace("  } catch {\n    return { kind: 'unreadable', why: 'corrupt' };\n  }",
            "  } catch {\n    return { kind: 'absent' };\n  }",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L5 "unreadable bytes must NOT become" \
  "B — a corrupt record is read as 'nothing pending'"

# ── B2 · the gate ignores the unreadable ceiling ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("  if (unreadable) return false;\n  if (pending?.action === 'revoke') return false;",
            "  if (pending?.action === 'revoke') return false;",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L6 "" "B — the effective gate ignores the unreadable ceiling"

# ── 10 · a corrupt disclosure version is restamped ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""  if (p.disclosureVersion === undefined) {
    return { kind: 'unreadable', why: 'corrupt' };
  }""","""  if (p.disclosureVersion === undefined) {
    p.disclosureVersion = DISCLOSURE_VERSION;
  }""",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L7 "" "10 — a missing disclosure version is restamped with the constant"

# ── A · delete-my-data clears local state regardless ──
py "$PRIV" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""  const result = await forgetAnalyticsIdentity();""",
"""  let result: { deleted: number; status: string };
  try { result = await forgetAnalyticsIdentity(); }
  finally { await clearLocalAuthorityState(); }""",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L8 "" "A — delete-my-data clears local state in a finally"

# ── D · `unknown` returns for an authenticated member again ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("  if (adopted === null) return { status: 'unsynced', granted };",
            "  if (adopted === null) return { status: 'unknown' };",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L9 "not \`unknown\` — that disabled the switch" \
  "D — a first-time member renders 'unknown' again (the deadlock)"

# ── F · suppression routed to needs_resolution ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("      identitySuppressed = true;","      identitySuppressed = false;",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L10 "suppression is permanent" \
  "F — a suppressed identity no longer renders terminally"

# ── 9 · conflict compares only the boolean ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("  return current.disclosureVersion === disclosureVersion;","  return true;",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L11 "the decision must actually be sent" \
  "9 — conflict resolution ignores the disclosure version"

# ── 2 · an unreadable read latches, so it never recovers ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("      if (p.kind !== 'unreadable') hydratedFor = userId;","      hydratedFor = userId;",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L12 "" "2 — an unreadable read latches and never retries"

# ── LAW C2 · back to the inert listener ──
py "$PRIV" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("import { subscribeScopeState } from '@/services/userScope';",
            "import { subscribeUserScope } from '@/services/userScope';",1)
s=s.replace("subscribeScopeState(() => {","subscribeUserScope(() => {",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L13 "subscribeUserScope is inert" \
  "LAW C2 — privacy_manager reverts to the inert listener"

# ── NON-VACUITY ──
py "$AUTH" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("export async function resolveEmissionIdentity(): Promise<string | null> {",
            "export async function resolveEmissionIdentity(): Promise<string | null> {\n  if (true) return null;",1)
assert s!=O, 'no apply'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check L14 "" "NON-VACUITY — the gate refuses everything"

echo; echo "── result ──"; echo "  KILLED: $PASS    MISSED: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1

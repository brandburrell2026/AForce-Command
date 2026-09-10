#!/usr/bin/env bash
# Mutation matrix for Lane 1b.
#
# Records WHICH assertion caught each mutant, because two barriers that mask
# each other prove neither — and this lane deliberately keeps a guard that is
# unreachable while the lock stands, so it must be labelled honestly rather
# than claimed as proven.
#
# Harness guards: every mutant asserts its patch applied; the exit code is
# captured as the FIRST statement after the run.
set -uo pipefail

REPO="/Users/brandonburrell/AForce-Command"
SRC="$REPO/lib/db/src/analyticsIdentityRepo.ts"
TEST="$REPO/lib/db/src/__tests__/analyticsIdentityRepo.drizzle.test.ts"
export DATABASE_URL='postgresql://postgres:password@127.0.0.1:55466/aforce_test'

SUITES=(
  "lib/db/src/__tests__/forgetConsentLedger.drizzle.test.ts"
  "lib/db/src/__tests__/advanceConsentCas.drizzle.test.ts"
  "lib/db/src/__tests__/analyticsIdentityRepo.drizzle.test.ts"
  "artifacts/api-server/src/routes/aforce/__tests__/analyticsIdentityRoutes.drizzle.test.ts"
)

BS=$(mktemp); BT=$(mktemp)
cp "$SRC" "$BS"; cp "$TEST" "$BT"
restore() { cp "$BS" "$SRC"; cp "$BT" "$TEST"; }
trap 'restore; rm -f "$BS" "$BT"' EXIT

run_suites() {
  ( cd "$REPO" && DB_TESTS=1 ./node_modules/.bin/vitest run --config vitest.db.config.ts \
      "${SUITES[@]}" >/tmp/mut-1b.out 2>&1 )
  rc=$?
  return $rc
}

PASS=0; FAIL=0

check() {
  id="$1"; expect_msg="$2"; desc="$3"
  if [ "${MUTANT_APPLIED:-1}" -ne 0 ]; then
    printf '  %-5s ERROR    patch did not apply — %s\n' "$id" "$desc"
    FAIL=$((FAIL + 1)); restore; return
  fi
  run_suites
  rc=$?
  if [ "$rc" -ne 0 ]; then
    if [ -z "$expect_msg" ] || grep -qF "$expect_msg" /tmp/mut-1b.out; then
      printf '  %-5s KILLED   %s\n' "$id" "$desc"
      [ -n "$expect_msg" ] && printf '            by: "%.68s..."\n' "$expect_msg"
    else
      printf '  %-5s KILLED*  %s  (not the named assertion)\n' "$id" "$desc"
      grep -E "AssertionError|Error:" /tmp/mut-1b.out | sed 's/^ *//' | sort -u | head -2
    fi
    PASS=$((PASS + 1))
  else
    printf '  %-5s MISSED   %s\n' "$id" "$desc"
    FAIL=$((FAIL + 1))
    grep -E "Tests +[0-9]+ passed" /tmp/mut-1b.out | tail -1
  fi
  restore
}

echo "── positive control (unmutated must be GREEN) ──"
run_suites
rc=$?
if [ "$rc" -ne 0 ]; then
  echo "  ABORT: red before any mutation."
  tail -40 /tmp/mut-1b.out; exit 1
fi
grep -E "Tests +[0-9]+ passed" /tmp/mut-1b.out | tail -1
echo "  OK — baseline green"
echo; echo "── ITEM 1 · forgetAnalyticsForMember ──"

# F1 · the LOCK. This is the correctness mechanism.
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""    // Take the consent row before deciding anything about it, so a concurrent
    // decision serialises behind this erase rather than racing it.
    const current = await lockConsentTx(tx, userId);""",
"""    const current = await readConsentTx(tx, userId);""",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check F1 "a member left opted in at their own erasure" \
  "the erase reverts to the UNLOCKED read"

# F2 · the affected-row check + evidence gate, WITH the lock still in place.
#      Expected to survive: unreachable while the row is locked. Recorded as
#      such rather than claimed proven.
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""      const row = applied[0];
      if (applied.length !== 1 || row === undefined) {""",
"""      const row = applied[0] ?? { decision_seq: nextSeq };
      if (false) {""",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check F2 "" "the evidence gate is removed (lock still present)"

# F3 · COMPOSITE: lock removed AND the evidence gate removed — i.e. exactly the
#      pre-repair code. Demonstrates the gate is load-bearing precisely when the
#      lock is gone, which is the only claim made for it.
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""    // Take the consent row before deciding anything about it, so a concurrent
    // decision serialises behind this erase rather than racing it.
    const current = await lockConsentTx(tx, userId);""",
"""    const current = await readConsentTx(tx, userId);""",1)
s=s.replace("""      const row = applied[0];
      if (applied.length !== 1 || row === undefined) {""",
"""      const row = applied[0] ?? { decision_seq: nextSeq };
      if (false) {""",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check F3 "the ledger contains a duplicated decision_seq" \
  "COMPOSITE — lock AND gate removed (the pre-repair code)"

# F4 · evidence carries the COMPUTED seq instead of the one the DB wrote.
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""      await appendEvidence(tx, userId, "suppress", current.disclosureVersion, row.decision_seq);""",
"""      await appendEvidence(tx, userId, "suppress", current.disclosureVersion, nextSeq + 1);""",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check F4 "the evidenced suppression must name the sequence that is operative" \
  "evidence names a sequence that is not the operative one"

# F5 · NON-VACUITY: the erase revokes nothing at all.
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""    const current = await lockConsentTx(tx, userId);
    if (current !== null && current.granted) {""",
"""    const current = await lockConsentTx(tx, userId);
    if (false && current !== null && current.granted) {""",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check F5 "" "NON-VACUITY — the erase never revokes consent"

echo; echo "── ITEM 2 · the pseudonym minter law ──"

# P1 · a timestamp-derived minter must be caught by the new law.
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
import re
m = re.search(r'export function mintAnalyticsId\(\)[^\n]*\{.*?\n\}', s, re.S)
assert m, 'could not locate mintAnalyticsId'
s = s[:m.start()] + (
  'export function mintAnalyticsId(): string {\n'
  '  return `anon_${Date.now().toString(36)}_${randomBytes(8).toString("hex")}`;\n'
  '}'
) + s[m.end():]
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check P1 "CLOCK ACCESSED" \
  "the minter is replaced by a TIMESTAMP-derived scheme"

# P2 · NON-VACUITY for the control: if the trap cannot detect a clock read,
#      the control law must fail.
python3 - "$TEST" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""    class TrapDate {
      constructor() { boom() }
      static now(): number { return boom() as never }""",
"""    class TrapDate {
      constructor() { /* trap disabled */ }
      static now(): number { return 0 }""",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check P2 "" "the clock trap is disabled (the control must notice)"

echo
echo "── result ──"
echo "  KILLED: $PASS    MISSED: $FAIL"
echo "  (F2 is EXPECTED to be MISSED — see docs/db/S1-3-LANE-1B.md)"

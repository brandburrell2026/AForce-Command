#!/usr/bin/env bash
# Mutation matrix for the S1-3 advanceConsent CAS repair.
#
# The repair uses TWO mechanisms. The founder's requirement is that each be
# mutation-tested INDEPENDENTLY — which is only meaningful if each mutant is
# killed by its OWN assertion rather than incidentally by the other's. So this
# harness records WHICH assertion went red, not just that something did.
#
# Two harness guards, both learned the hard way in this program:
#   - every mutant asserts its patch actually changed the file (a patch that
#     silently fails to match produces a green run that reads as MISSED);
#   - the exit code is captured as the FIRST statement after the run (`local`
#     and anything else resets $?).
set -uo pipefail

REPO="/Users/brandonburrell/AForce-Command"
SRC="$REPO/lib/db/src/analyticsIdentityRepo.ts"
export DATABASE_URL='postgresql://postgres:password@127.0.0.1:55466/aforce_test'

SUITES=(
  "lib/db/src/__tests__/advanceConsentCas.drizzle.test.ts"
  "lib/db/src/__tests__/analyticsIdentityRepo.drizzle.test.ts"
  "artifacts/api-server/src/routes/aforce/__tests__/analyticsIdentityRoutes.drizzle.test.ts"
)

BACKUP=$(mktemp)
cp "$SRC" "$BACKUP"
trap 'cp "$BACKUP" "$SRC"; rm -f "$BACKUP"' EXIT

run_suites() {
  ( cd "$REPO" && DB_TESTS=1 ./node_modules/.bin/vitest run --config vitest.db.config.ts \
      "${SUITES[@]}" >/tmp/mut-cas.out 2>&1 )
  rc=$?
  return $rc
}

PASS=0; FAIL=0

check() {
  id="$1"; expect_msg="$2"; desc="$3"
  if [ "${MUTANT_APPLIED:-1}" -ne 0 ]; then
    printf '  %-4s ERROR    patch did not apply — %s\n' "$id" "$desc"
    FAIL=$((FAIL + 1)); cp "$BACKUP" "$SRC"; return
  fi
  run_suites
  rc=$?
  if [ "$rc" -ne 0 ]; then
    # WHICH assertion caught it?
    if grep -qF "$expect_msg" /tmp/mut-cas.out; then
      printf '  %-4s KILLED   %s\n' "$id" "$desc"
      printf '           by the intended assertion: "%.70s..."\n' "$expect_msg"
      PASS=$((PASS + 1))
    else
      printf '  %-4s KILLED*  %s\n' "$id" "$desc"
      printf '           but NOT by the intended assertion — check /tmp/mut-cas.out\n'
      grep -E "AssertionError" /tmp/mut-cas.out | head -2
      PASS=$((PASS + 1))
    fi
  else
    printf '  %-4s MISSED   %s\n' "$id" "$desc"
    FAIL=$((FAIL + 1))
    grep -E "Tests +[0-9]+ passed" /tmp/mut-cas.out | tail -1
  fi
  cp "$BACKUP" "$SRC"
}

echo "── positive control (unmutated source must be GREEN) ──"
run_suites
rc=$?
if [ "$rc" -ne 0 ]; then
  echo "  ABORT: red before any mutation. Every result below would be meaningless."
  tail -40 /tmp/mut-cas.out
  exit 1
fi
grep -E "Tests +[0-9]+ passed" /tmp/mut-cas.out | tail -1
echo "  OK — baseline green"
echo
echo "── mutants ──"

# ── MA · the LOCK. Removing it must break the CANONICAL-STATE guarantee. ──
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""      select granted, decision_seq, disclosure_version
        from ${aforceAnalyticsConsentState} where user_id = ${userId}
        for update
    `),""","""      select granted, decision_seq, disclosure_version
        from ${aforceAnalyticsConsentState} where user_id = ${userId}
    `),""",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check MA "the loser must receive the CANONICAL current state" \
  "lockConsentTx no longer locks (FOR UPDATE removed)"

# ── MB · the AFFECTED-ROW CHECK on the update path. ──
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""    if (applied.length !== 1) {
      // The expectation did not match. Nothing was written, so nothing is
      // claimed and no evidence is appended.
      return { ok: false as const, current };
    }
""","",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check MB "a caller that lost the CAS must not receive ok:true" \
  "the CAS affected-row check is removed (the original defect)"

# ── MC · the affected-row check on the FIRST-DECISION path. ──
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""      if (inserted.length !== 1) {
        // Refused. Report the canonical state, read under the lock so it is
        // the committed truth and not a snapshot from before the winner.
        return { ok: false as const, current: await lockConsentTx(tx, args.userId) };
      }
""","",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check MC "the losing first-decision must not report success" \
  "the first-decision insert result is not checked"

# ── MD · evidence appended BEFORE the update is confirmed (old ordering). ──
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""    if (applied.length !== 1) {
      // The expectation did not match. Nothing was written, so nothing is
      // claimed and no evidence is appended.
      return { ok: false as const, current };
    }
    await appendEvidence(tx, args.userId, args.action, args.disclosureVersion, nextSeq);""",
"""    await appendEvidence(tx, args.userId, args.action, args.disclosureVersion, nextSeq);
    if (applied.length !== 1) {
      return { ok: false as const, current };
    }""",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check MD "the append-only consent log must never describe a transition that" \
  "evidence is appended before the update is confirmed applied"

# ── ME · NON-VACUITY. Refuse everything. ──
python3 - "$SRC" <<'PY'
import sys, io
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read(); O=s
s=s.replace("""  assertRealMember(args.userId);
  const granted = args.action === "grant";
  return dbx.transaction(async (tx) => {""",
"""  assertRealMember(args.userId);
  const granted = args.action === "grant";
  if (true) return { ok: false as const, current: null };
  return dbx.transaction(async (tx) => {""",1)
assert s != O, 'MUTANT DID NOT APPLY'
io.open(p,'w',encoding='utf-8').write(s)
PY
MUTANT_APPLIED=$?
check ME "an uncontended CAS with the right expectation must APPLY" \
  "NON-VACUITY CONTROL — advanceConsent refuses everything"

echo
echo "── result ──"
echo "  KILLED: $PASS    MISSED: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1

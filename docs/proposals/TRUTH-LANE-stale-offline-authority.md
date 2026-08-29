# Truth lane — stale/offline authority is produced but never shown

**Status:** recommendation only. Not implemented. Opened per the founder's
E2 ruling ("Do not hide or solve it cosmetically inside E2. Open a separate,
narrowly scoped recommendation for the smallest fix that makes stale/offline
authority visible without changing scoring or recommendation logic.")

**Discovered by:** the E2 Home recon (2026-08-29), confirmed by an
independent adversarial verifier against `main @ ccd1042a`.

## The defect

The API layer is already honest. `fetchHome` catches a `/state` failure and
returns the caller's own last state with a locally recomputed score and an
explicit discriminator (`services/realApi.ts:279-285`):

```ts
return { engineOutput: calculateScore(userState), userState, serverTime: null, stale: true };
```

The comment there records that this replaced "the old fabricated success
envelope (which minted a fresh server clock for a server that was never
reached)". It is locked by `services/__tests__/honestDegradedModes.test.ts`.

**Every consumer throws the discriminator away.** Both call sites destructure
only two fields (`store/useAppStore.tsx:488` and `:517`; the same shape in
`store/app/actions.ts`), and a repo-wide search finds no reader of
`HomePayload.stale` outside `realApi.ts` and its own test.

**What the member sees offline:** last-known state, with a score that keeps
decaying locally, presented with exactly the same visual authority as a
server-fresh reading. Home has no pull-to-refresh, refresh failures are
swallowed (`useAppStore.tsx:537-538`, "swallow — UI keeps last known
engineOutput"), and the only offline-labelled surface — `AFOfflineBanner` —
is scoped to the intake outbox and is flag-dead in production
(`offline_intake_outbox_enabled: false`).

**The near-miss:** Home *does* show "Checked 2d ago — data is stale". That
copy measures a **different axis** — wearable `fetchedAt` age past 24h
(`homeFreshness.ts`) — and says nothing about server reachability. A member
could read it as offline coverage; it is not.

This is the same class as the fabricated-zero findings: the honest value
exists upstream and is dropped before it reaches the member.

## The smallest fix

Three small steps, no scoring or recommendation change:

1. **Keep the flag** — stop discarding it. Destructure `stale` at the two
   `fetchHome` call sites and carry it into the store as one boolean
   (e.g. `lastRefreshStale`), set on every refresh outcome.
2. **Surface it as evidence, not alarm** — one quiet furniture word on the
   existing evidence/freshness line (the Cover's `EdEvidenceLine`, V2's
   freshness caption). No banner, no modal, no colour change: this is a
   statement about the DATA, matching the EVIDENCE-chip precedent.
3. **Lock it** — pin that a stale payload reaches the UI labelled, and that
   a fresh payload clears the label.

**Explicitly out of scope:** scoring, recommendation, the Decision Guard,
retry/pull-to-refresh affordances (Home deliberately has none today), and
any change to the wearable-freshness axis.

## Why it is not in E2

The fix lives in the store/service plumbing, on the far side of the
presentation boundary the E2 charter draws ("the visual layer consumes
existing truth; it does not create truth"). Adding a staleness word to the
Cover without the plumbing would be exactly the cosmetic solve the ruling
forbids — the label would have nothing true behind it.

## Founder decision requested

Authorize (or decline) this as its own bounded PR. Estimated blast radius:
two destructure sites, one store field, one reducer case, one copy key, one
lock — no engine, no guard, no network behavior change.

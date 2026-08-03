# Device & Account Inventory Template

**Last verified:** 2026-08-03
**Rule:** this template records **presence/absence only**. Never record a
secret value, token, credential string, or password in any copy of this
form — "have Oura client secret: yes/no" is correct; the secret itself is
never correct here, in a screenshot, in a commit, or in chat. See
`REDACTION.md` and the project's off-limits rule on secrets (never print,
log, copy, export, or commit any secret value; confirming existence is
fine, revealing or moving the value is not).

Copy this per validation cycle and fill in what each squad actually has
before starting — a runbook step blocked on missing hardware/credentials
should be caught here, not discovered mid-run.

```
## Device & Account Inventory — <date>

### Apple (Squad A)
- iPhone model:
- iOS version:
- Signing access (dev team / provisioning profile available): yes/no
- HealthKit entitlement present on the build: yes/no
- Test Apple ID available: yes/no
- Health app has representative data (sleep, HR, HRV, workouts) already present: yes/no
- Apple Watch paired (optional, for HR/HRV/workout richness): yes/no, model if yes

### Android — general (Squad B)
- Device model:
- Android version:
- Health Connect app version:
- Google Play services version:

### Samsung (Squad B)
- Galaxy device model:
- Android version:
- Samsung Health app version:
- Samsung Watch or Galaxy Ring paired: yes/no, model if yes
- Health Connect sync enabled in Samsung Health settings: yes/no

### Oura (Squad C)
- OAuth app ID configured (dev/staging): present/absent
- Redirect URI configured and matches app config: yes/no
- Test user account available: yes/no
- Ring or account-only (no ring) test setup: which
- Account has historical data (not a brand-new empty account): yes/no
- Required env vars present (name only, e.g. OURA_CLIENT_ID, OURA_CLIENT_SECRET, OURA_TOKEN_ENCRYPTION_KEY): present/absent per var, values never recorded

### WHOOP (Squad D)
- OAuth credentials configured (dev/staging): present/absent
- Test user account available: yes/no
- Production encryption key presence verified (WHOOP_TOKEN_ENCRYPTION_KEY or equivalent — presence only, never value): present/absent
- Redirect URI configured and matches app config: yes/no
- Env config complete (name only, values never recorded): present/absent per var

### Garmin (dormant — engineering-readiness tracking only, see docs/health/garmin/)
- Partner-application state: not started / submitted / approved (to be confirmed — founder/partner-portal owned)
- Portal access: present/absent
- Credentials: present/absent
- Docs reviewed and current: yes/no, date
- Webhook endpoint readiness (Garmin is push-model, see WEBHOOK-ARCHITECTURE-PLAN.md): planned/built/none
```

## Why presence-only

This form exists to unblock scheduling ("do we have what we need to start
Squad C this week") without ever becoming a place a secret could leak
through a doc, a screenshot, or a copy-paste into chat. If a squad needs to
confirm an env var's actual value is correct (not just present), that check
happens directly against the runtime (EAS env, Railway config) by someone
with access — never by pasting the value into this document or any
validation evidence packet.

# Website lead capture and Microsoft 365 notifications

Four forms: `/`, `/shop`, `/aforce-os`, `/founding-250`. Each posts to the same-origin `/api/founding-250` function. It validates email, origin, payload size, honeypot and source, then calls the existing Railway `/api/early-access` service. It reports success only for a confirmed database save. API rate limiting remains in place; the Vercel per-instance rate limit is additional best-effort protection, not a globally distributed limit.

The lead and its internal notification are committed in one database transaction. The application lazily creates **only** the new `aforce_signup_notifications` table with `CREATE TABLE IF NOT EXISTS`, referencing the existing signup table. No existing tables, leads, or migration-ledger entries are altered. Database roles without CREATE permission must have this table created by their database administrator first (definition in `src/lib/signupNotifications.ts`). If queue persistence fails, capture rolls back and the form offers retry.

The worker claims a pending row with a two-minute lease, sends through Microsoft Graph and records `accepted_at` only on HTTP 202. Failures retry with increasing delay (up to one hour) and survive process restarts. Retries are at-least-once: an ambiguous network timeout/crash after Microsoft accepts may produce a duplicate bearing the same signup reference. Repeated visitor submissions do not create duplicate leads or queue rows. Existing leads from before this release are not backfilled automatically.

The internal recipient is fixed to `info@alkalineforce.com`. Existing visitor confirmations still use the existing mailer and configuration. Existing contact, partnership, support, checkout and legal links retain their destinations.

## Microsoft administrator setup

The observed Microsoft tenant is `72ea3c85-29c6-4250-a086-58f54180162f` (Global Crew Services, LLC), signed in with the alkalineforce.com administrator. Verify that tenant and the intended sending mailbox before granting access.

1. Register a single-tenant app named **AFORCE Website Signup Notifications**. No interactive redirect URI is needed for the client-credentials flow.
2. Authorize **Application Mail.Send** for only the chosen sending mailbox using **Exchange Online Application RBAC**. Register the Entra enterprise application's service principal in Exchange, define a recipient scope for that mailbox, and assign `Application Mail.Send` with that custom resource scope. Test authorization for both the allowed mailbox and an unrelated mailbox. Avoid an additional tenant-wide Entra `Mail.Send` grant: Microsoft documents that Entra and RBAC permissions are additive, which can defeat the mailbox restriction.
3. The administrator creates a client credential and puts its value **directly** into Railway's encrypted service variables. Do not paste secrets into chat, browser source, code, or GitHub. Use a short lifetime with a rotation reminder owned by the administrator.
4. Set these variables on Railway project **affectionate-gratitude**, service **AForce-Command**, environment **production**:
   - `M365_TENANT_ID`: the verified tenant ID above.
   - `M365_CLIENT_ID`: the new application's client ID.
   - `M365_CLIENT_SECRET`: its secret value, entered directly in Railway.
   - `M365_SIGNUP_SENDER`: an authorized, existing Exchange Online sending mailbox, such as `info@alkalineforce.com` **if verified to exist and authorized**.
5. Redeploy the service with the new variables. Pending notifications then retry automatically. No public frontend variables or Microsoft credentials are needed in Vercel.

There is no MX/SPF/DKIM record change required merely to call Microsoft Graph for an existing Microsoft 365 mailbox. Preserve existing DNS; the observed SPF already includes `spf.protection.outlook.com`. The administrator should verify that DKIM is enabled for the existing domain and review its current DMARC policy in the normal mail administration workflow.

## Verify and operate

- Submit a clearly labeled test address owned by AFORCE through each form; check the existing admin signup list/CSV for email and source.
- Authenticated administrator: `GET /api/early-access/admin/notifications` reports provider configuration, pending count and provider-accepted count. It does not expose credentials or submitted emails.
- Logs contain signup references and bounded error codes, not Graph tokens or provider response bodies. `m365_token_http_401` indicates credential trouble; `m365_send_http_403` indicates mailbox/permission trouble; 429/5xx remain queued.
- Microsoft Graph HTTP 202 establishes provider acceptance **only**. Confirm actual receipt at `info@alkalineforce.com`, or use Exchange message trace and quarantine checks. Do not claim inbox delivery based on HTTP status alone.
- If sending authorization is absent, leads remain captured with pending notification rows; no delivery claim is made. Visitor confirmations remain separately dependent on the preexisting mailer provider.

References:
- https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac

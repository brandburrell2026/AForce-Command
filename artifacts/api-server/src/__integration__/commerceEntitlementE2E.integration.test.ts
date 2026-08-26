/**
 * Wave-3 PR13 — COMMERCE + OBSERVABILITY E2E LANE (behavioral, real
 * Postgres via Testcontainers; no fake-green mock assertions).
 *
 * Drives the REAL route handlers and the REAL entitlement resolver over
 * a real database:
 *
 *   PURCHASE → ENTITLEMENT            (Shopify rail: HMAC-signed
 *                                      orders/paid → web-entitlement row
 *                                      → resolveEntitlement grants)
 *   DUPLICATE WEBHOOK → NO DUP GRANT  (same X-Shopify-Webhook-Id →
 *                                      suppressed; ONE ledger row)
 *   REFUND → ENTITLEMENT CHANGE       (orders/refunded → grant revoked)
 *   CLIENT RESTART → RESTORED         (fresh authority read re-grants —
 *                                      no client state involved)
 *   STRIPE RAIL (mirror)              (stripe.* rows → resolver picks
 *                                      plan; canceled → forced core
 *                                      downgrade WRITTEN to cache)
 *   API FAILURE → HONEST ERROR        (uncaught throw → fixed JSON 500)
 *   DB FAILURE → READINESS DEGRADED   (pool ended → /healthz/deep 503
 *                                      unready) + ENTITLEMENT LOOKUP
 *                                      FAILURE → FAIL CLOSED (503,
 *                                      never next()) — run LAST.
 *
 * The api-server modules bind the @workspace/db singleton at import, so
 * DATABASE_URL is set to the container BEFORE any dynamic import — all
 * server imports happen inside beforeAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

// Clerk is not under test — the identity bridge returns a verified email.
vi.mock('@clerk/express', () => ({
  clerkClient: {
    users: {
      getUser: async (id: string) => ({
        primaryEmailAddressId: 'em_1',
        emailAddresses: [
          {
            id: 'em_1',
            emailAddress: `${id}@buyer.example`,
            verification: { status: 'verified' },
          },
        ],
      }),
    },
  },
}));

const SHOPIFY_SECRET = 'e2e_test_secret';
const COMMAND_VARIANT = 43905417838710;
const USER = 'user_e2e_A';
const EMAIL = `${USER}@buyer.example`;

const DDL = `
CREATE TABLE "aforce_users" (
  "id" text PRIMARY KEY,
  "email" text,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "plan_id" text NOT NULL DEFAULT 'core',
  "subscription_status" text NOT NULL DEFAULT 'none',
  "current_period_end" timestamptz,
  "referral_code" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "aforce_web_entitlements" (
  "id" serial PRIMARY KEY,
  "user_id" text,
  "email" text NOT NULL,
  "plan_id" text NOT NULL,
  "source" text NOT NULL,
  "external_ref" text NOT NULL,
  "status" text NOT NULL,
  "current_period_end" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "aforce_web_entitlements_source_ref_uq"
  ON "aforce_web_entitlements" ("source", "external_ref");
CREATE TABLE "aforce_webhook_deliveries" (
  "id" serial PRIMARY KEY,
  "source" text NOT NULL,
  "delivery_id" text NOT NULL,
  "topic" text NOT NULL DEFAULT '',
  "action" text NOT NULL DEFAULT '',
  "external_ref" text,
  "received_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "aforce_webhook_deliveries_source_delivery_uq"
  ON "aforce_webhook_deliveries" ("source", "delivery_id");
CREATE SCHEMA "stripe";
CREATE TABLE "stripe"."products" ( "id" text PRIMARY KEY, "metadata" jsonb );
CREATE TABLE "stripe"."prices" ( "id" text PRIMARY KEY, "product" text, "metadata" jsonb );
CREATE TABLE "stripe"."subscriptions" (
  "id" text PRIMARY KEY, "customer" text, "status" text,
  "current_period_end" bigint, "created" timestamptz DEFAULT now()
);
CREATE TABLE "stripe"."subscription_items" ( "id" text PRIMARY KEY, "subscription" text, "price" text );
`;

function sign(raw: Buffer): string {
  return createHmac('sha256', SHOPIFY_SECRET).update(raw).digest('base64');
}

function paidOrderFixture(orderId: number) {
  return {
    id: orderId,
    email: EMAIL,
    line_items: [{ variant_id: COMMAND_VARIANT, quantity: 1 }],
  };
}

let container: StartedPostgreSqlContainer;
let server: Server;
let baseUrl: string;
// dynamically imported server modules (bound to the container DB)
let resolveEntitlement: (userId: string) => Promise<{ planId: string; status: string }>;
let requireEntitlement: (featureId: string) => unknown;
let dbmod: typeof import('@workspace/db');

async function postWebhook(
  topic: string,
  payload: unknown,
  deliveryId: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const raw = Buffer.from(JSON.stringify(payload));
  const res = await fetch(`${baseUrl}/api/shopify/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Shopify-Topic': topic,
      'X-Shopify-Hmac-Sha256': sign(raw),
      'X-Shopify-Webhook-Id': deliveryId,
    },
    body: raw,
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env['DATABASE_URL'] = container.getConnectionUri();
  process.env['SHOPIFY_WEBHOOK_SECRET'] = SHOPIFY_SECRET;
  process.env['NODE_ENV'] = 'test';
  process.env['CLERK_SECRET_KEY'] = 'sk_e2e_configured';

  // Import AFTER env is set — the singleton pool binds now.
  dbmod = await import('@workspace/db');
  await dbmod.pool.query(DDL);

  const resolver = await import(
    '../lib/entitlementResolver'
  );
  resolveEntitlement = resolver.resolveEntitlement;
  const mw = await import(
    '../middlewares/requireEntitlement'
  );
  requireEntitlement = mw.requireEntitlement;

  const { default: shopifyRouter } = await import(
    '../routes/shopifyWebhook'
  );
  const { livenessHandler, readinessHandler } = await import(
    '../health/checks'
  );
  const { registerProductionChecks } = await import(
    '../health/registerChecks'
  );
  registerProductionChecks();

  const expressMod = await import('express');
  const express = expressMod.default;
  const app = express();
  app.use('/api', shopifyRouter);
  app.get('/healthz/deep', readinessHandler());
  app.get('/healthz', livenessHandler());
  app.get('/boom', () => {
    throw new Error('intentional');
  });
  // the real error-middleware shape (fixed body, no internal detail)
  type Req = import('express').Request;
  type Res = import('express').Response;
  type Next = import('express').NextFunction;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Req, res: Res, _next: Next) => {
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
  });
  server = await new Promise((r) => {
    const s = app.listen(0, () => r(s));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 180_000);

afterAll(async () => {
  server?.close();
  await dbmod?.pool.end().catch(() => {});
  await container?.stop();
});

describe('PURCHASE → VERIFIED TX → IDENTITY → GRANT → AUTHORIZATION (Shopify rail)', () => {
  it('an HMAC-verified Command order grants athlete to the matching verified email', async () => {
    const hook = await postWebhook('orders/paid', paidOrderFixture(70001), 'dlv-1');
    expect(hook.status).toBe(200);
    expect(hook.body['ok']).toBe(true);

    // first authenticated read creates the user row WITH the verified email
    // (PR4 bridge) and the web rail grants.
    const resolved = await resolveEntitlement(USER);
    expect(resolved.planId).toBe('athlete');
    expect(resolved.status).toBe('active');
  });

  it('DUPLICATE WEBHOOK → suppressed, ONE ledger row, no duplicate grant', async () => {
    const dup = await postWebhook('orders/paid', paidOrderFixture(70001), 'dlv-1');
    expect(dup.body['duplicate']).toBe(true);
    const ledger = await dbmod.pool.query(
      `SELECT count(*)::int AS n FROM aforce_webhook_deliveries WHERE source='shopify' AND delivery_id='dlv-1'`,
    );
    expect(ledger.rows[0].n).toBe(1);
    const rows = await dbmod.pool.query(
      `SELECT count(*)::int AS n FROM aforce_web_entitlements WHERE external_ref='70001'`,
    );
    expect(rows.rows[0].n).toBe(1);
    expect((await resolveEntitlement(USER)).planId).toBe('athlete');
  });

  it('CLIENT RESTART → entitlement restored from AUTHORITY (no client state)', async () => {
    // a fresh read with zero carried state is exactly what a restarted
    // client does via /api/entitlement
    const resolved = await resolveEntitlement(USER);
    expect(resolved.planId).toBe('athlete');
  });

  it('REFUND → entitlement change (grant revoked, resolver returns core)', async () => {
    const refund = await postWebhook('orders/refunded', paidOrderFixture(70001), 'dlv-2');
    expect(refund.status).toBe(200);
    const resolved = await resolveEntitlement(USER);
    expect(resolved.planId).toBe('core');
  });
});

describe('Stripe rail (synced mirror → resolver)', () => {
  it('an active mirror subscription grants its plan; cancellation force-downgrades the cache', async () => {
    const stripeUser = 'user_e2e_stripe';
    await dbmod.pool.query(
      `INSERT INTO aforce_users (id, email, stripe_customer_id, plan_id, subscription_status)
       VALUES ($1, $2, 'cus_e2e', 'core', 'none')`,
      [stripeUser, `${stripeUser}@buyer.example`],
    );
    await dbmod.pool.query(`INSERT INTO stripe.products VALUES ('prod_1', '{"planId":"athlete"}')`);
    await dbmod.pool.query(`INSERT INTO stripe.prices VALUES ('price_1', 'prod_1', '{"planId":"athlete"}')`);
    await dbmod.pool.query(
      `INSERT INTO stripe.subscriptions (id, customer, status, current_period_end) VALUES ('sub_1', 'cus_e2e', 'active', extract(epoch from now() + interval '30 days')::bigint)`,
    );
    await dbmod.pool.query(`INSERT INTO stripe.subscription_items VALUES ('si_1', 'sub_1', 'price_1')`);

    expect((await resolveEntitlement(stripeUser)).planId).toBe('athlete');

    // cancellation: the live sub disappears from the entitling set →
    // resolver force-downgrades AND persists the downgrade
    await dbmod.pool.query(`UPDATE stripe.subscriptions SET status='canceled' WHERE id='sub_1'`);
    const after = await resolveEntitlement(stripeUser);
    expect(after.planId).toBe('core');
    const cached = await dbmod.pool.query(
      `SELECT plan_id FROM aforce_users WHERE id=$1`,
      [stripeUser],
    );
    expect(cached.rows[0].plan_id).toBe('core');
  });
});

describe('observability behavior', () => {
  it('API FAILURE → honest fixed error body (never internal detail)', async () => {
    const res = await fetch(`${baseUrl}/boom`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal_error' });
  });

  it('healthy DB → /healthz/deep reports ok with the database check green', async () => {
    const res = await fetch(`${baseUrl}/healthz/deep`);
    const body = (await res.json()) as { status: string; checks: Array<{ name: string; ok: boolean }> };
    expect(res.status).toBe(200);
    expect(body.checks.find((c) => c.name === 'database')?.ok).toBe(true);
  });

  // ── destructive from here: the pool goes away ──
  it('DB FAILURE → readiness degrades to 503 unready; ENTITLEMENT LOOKUP FAILURE → fail closed', async () => {
    await dbmod.pool.end();

    const health = await fetch(`${baseUrl}/healthz/deep`);
    expect(health.status).toBe(503);
    const body = (await health.json()) as { status: string };
    expect(body.status).toBe('unready');

    // the REAL middleware + REAL resolver against the dead pool
    const mw = (requireEntitlement as (f: string) => (req: never, res: never, next: () => void) => Promise<void>)(
      'recovery_mode_enabled',
    );
    const result: { status: number | null; nexted: boolean } = { status: null, nexted: false };
    const res = {
      status(code: number) {
        result.status = code;
        return this;
      },
      json() {
        return this;
      },
    };
    await mw({ userId: USER, headers: {} } as never, res as never, () => {
      result.nexted = true;
    });
    expect(result.nexted).toBe(false);
    expect(result.status).toBe(503);
  });
});

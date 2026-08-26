/**
 * Stripe client + StripeSync wiring.
 *
 * Pulls credentials from the Replit Connectors API on every call (tokens
 * can rotate, so we never cache the secret). Exposes:
 *   - getUncachableStripeClient() → fresh Stripe SDK instance
 *   - getStripeSync()              → fresh StripeSync (for webhook + backfill)
 *   - getStripeClient()            → legacy alias for getUncachableStripeClient
 */

import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';

interface StripeCredentials {
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
}

async function getStripeCredentials(): Promise<StripeCredentials> {
  // Wave-3 PR2: standard env vars are the PRIMARY credential source so the
  // actual production deployment (Railway) can operate; the Replit
  // Connectors API remains the fallback for Replit-hosted dev. Missing
  // configuration still fails loudly (throws below) — never silently.
  const envSecret = process.env['STRIPE_SECRET_KEY'];
  if (envSecret) {
    return {
      secretKey: envSecret,
      publishableKey: process.env['STRIPE_PUBLISHABLE_KEY'],
      webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
    };
  }

  const hostname = process.env['REPLIT_CONNECTORS_HOSTNAME'];
  const token = process.env['REPL_IDENTITY']
    ? `repl ${process.env['REPL_IDENTITY']}`
    : process.env['WEB_REPL_RENEWAL']
      ? `depl ${process.env['WEB_REPL_RENEWAL']}`
      : null;

  if (!hostname || !token) {
    throw new Error(
      'Stripe is not configured: set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET) ' +
      'in the deployment environment, or connect the Stripe integration in the Replit workspace.',
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: 'application/json', X_REPLIT_TOKEN: token },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as { items?: Array<{ settings?: Record<string, string> }> };
  const settings = data.items?.[0]?.settings;
  const secretKey = settings?.['secret_key'] ?? settings?.['secret'];
  const publishableKey = settings?.['publishable_key'] ?? settings?.['publishable'];
  const webhookSecret = settings?.['webhook_secret'];
  if (!secretKey) {
    throw new Error('Stripe credentials missing secret key.');
  }
  return { secretKey, publishableKey, webhookSecret };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/** Legacy alias — kept so existing imports keep compiling. */
export const getStripeClient = getUncachableStripeClient;

// Wave-3 PR6: StripeSync owns a pg.Pool (max 10, keepAlive). It was
// constructed PER WEBHOOK REQUEST and never closed — every delivery leaked
// a pool (an unauthenticated DB-exhaustion vector). Memoize per secret so
// the pool is shared; a rotated key (Replit connector mode) still swaps
// the instance.
let cachedSync: { key: string; sync: StripeSync } | null = null;

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const { secretKey, webhookSecret } = await getStripeCredentials();
  if (cachedSync && cachedSync.key === secretKey) return cachedSync.sync;
  const sync = new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    // undefined (NOT '') so the sync package's managed-webhook fallback
    // and its fail-closed no-secret throw stay distinguishable.
    ...(webhookSecret ? { stripeWebhookSecret: webhookSecret } : {}),
  });
  cachedSync = { key: secretKey, sync };
  return sync;
}

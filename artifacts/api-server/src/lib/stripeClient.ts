/**
 * Stripe client.
 *
 * Pulls credentials from the Replit Connectors API on every call (tokens can
 * rotate, so we never cache the secret). Exposed via `getStripeClient()`
 * which returns a fully-configured Stripe SDK instance.
 */

import Stripe from 'stripe';

interface StripeCredentials {
  secret_key: string;
  publishable_key?: string;
}

async function getStripeCredentials(): Promise<StripeCredentials> {
  const hostname = process.env['REPLIT_CONNECTORS_HOSTNAME'];
  const token = process.env['REPL_IDENTITY']
    ? `repl ${process.env['REPL_IDENTITY']}`
    : process.env['WEB_REPL_RENEWAL']
      ? `depl ${process.env['WEB_REPL_RENEWAL']}`
      : null;

  if (!hostname || !token) {
    throw new Error(
      'Stripe integration is not configured. ' +
      'Connect the Stripe integration in the Replit workspace.',
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
  // The connector exposes the keys under either `secret`/`publishable` or the
  // long-form names depending on its version — accept both.
  const secret_key = settings?.['secret_key'] ?? settings?.['secret'];
  const publishable_key = settings?.['publishable_key'] ?? settings?.['publishable'];
  if (!secret_key) {
    throw new Error('Stripe credentials missing secret key.');
  }
  return { secret_key, publishable_key };
}

export async function getStripeClient(): Promise<Stripe> {
  const { secret_key } = await getStripeCredentials();
  return new Stripe(secret_key);
}

/**
 * Scripts-side Stripe client. Mirror of the api-server's stripeClient
 * — duplicated rather than imported because the scripts package has no
 * compile dep on @workspace/api-server.
 */

import Stripe from 'stripe';

interface Creds { secretKey: string }

async function getStripeCredentials(): Promise<Creds> {
  const hostname = process.env['REPLIT_CONNECTORS_HOSTNAME'];
  const token = process.env['REPL_IDENTITY']
    ? `repl ${process.env['REPL_IDENTITY']}`
    : process.env['WEB_REPL_RENEWAL']
      ? `depl ${process.env['WEB_REPL_RENEWAL']}`
      : null;
  if (!hostname || !token) {
    throw new Error(
      'Missing Replit environment variables. ' +
      'Ensure the Stripe integration is connected via the Integrations tab.',
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
  if (!secretKey) throw new Error('Stripe credentials missing secret key.');
  return { secretKey };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

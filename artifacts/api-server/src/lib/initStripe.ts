/**
 * One-time Stripe + stripe-replit-sync bootstrap.
 *
 * Order is significant (per the stripe-replit-sync docs):
 *   1. runMigrations()              — creates the `stripe` schema & tables
 *   2. getStripeSync()              — needs the schema to exist
 *   3. findOrCreateManagedWebhook() — registers the public webhook URL
 *   4. syncBackfill()               — pulls existing Stripe data into PG
 *
 * Failures are logged but do NOT crash the server — the app still serves
 * non-Stripe routes (e.g. AForce intake/state). The Stripe integration
 * may simply be unconnected in the dev sandbox.
 */

import { runMigrations } from 'stripe-replit-sync';
import { serializeError } from "../lib/serializeError";
import { getStripeSync } from './stripeClient';
import { logger } from './logger';

export async function initStripe(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    logger.warn('initStripe: DATABASE_URL missing — skipping Stripe sync setup');
    return;
  }

  try {
    await runMigrations({ databaseUrl });
  } catch (err) {
    logger.error({ err: serializeError(err) }, 'initStripe: runMigrations failed');
    return;
  }

  let stripeSync;
  try {
    stripeSync = await getStripeSync();
  } catch (err) {
    logger.warn({ err }, 'initStripe: getStripeSync failed — Stripe likely not connected');
    return;
  }

  // Wave-3 PR2: the deployment's public URL is the primary source (Railway
    // sets neither Replit var, so the managed Stripe webhook was NEVER
    // registered off-Replit — entitlements silently never synced).
    const publicBase = process.env['PUBLIC_BASE_URL']?.replace(/\/+$/, '');
    const domain = process.env['REPLIT_DOMAINS']?.split(',')[0] ?? process.env['REPLIT_DEV_DOMAIN'];
  if (publicBase || domain) {
    try {
      const webhookUrl = publicBase
        ? `${publicBase}/api/stripe/webhook`
        : `https://${domain}/api/stripe/webhook`;
      await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info({ webhookUrl }, 'initStripe: managed webhook ensured');
    } catch (err) {
      logger.error({ err: serializeError(err) }, 'initStripe: findOrCreateManagedWebhook failed');
    }
  } else {
    logger.warn('initStripe: no PUBLIC_BASE_URL or REPLIT_DOMAINS/REPLIT_DEV_DOMAIN — managed Stripe webhook NOT registered; entitlements will not sync');
  }

  try {
    await stripeSync.syncBackfill();
    logger.info('initStripe: syncBackfill complete');
  } catch (err) {
    logger.error({ err: serializeError(err) }, 'initStripe: syncBackfill failed');
  }
}

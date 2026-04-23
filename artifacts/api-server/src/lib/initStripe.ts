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
    logger.error({ err }, 'initStripe: runMigrations failed');
    return;
  }

  let stripeSync;
  try {
    stripeSync = await getStripeSync();
  } catch (err) {
    logger.warn({ err }, 'initStripe: getStripeSync failed — Stripe likely not connected');
    return;
  }

  const domain = process.env['REPLIT_DOMAINS']?.split(',')[0] ?? process.env['REPLIT_DEV_DOMAIN'];
  if (domain) {
    try {
      const webhookUrl = `https://${domain}/api/stripe/webhook`;
      await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info({ webhookUrl }, 'initStripe: managed webhook ensured');
    } catch (err) {
      logger.error({ err }, 'initStripe: findOrCreateManagedWebhook failed');
    }
  } else {
    logger.warn('initStripe: no REPLIT_DOMAINS / REPLIT_DEV_DOMAIN — webhook not registered');
  }

  try {
    await stripeSync.syncBackfill();
    logger.info('initStripe: syncBackfill complete');
  } catch (err) {
    logger.error({ err }, 'initStripe: syncBackfill failed');
  }
}

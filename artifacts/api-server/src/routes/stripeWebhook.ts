/**
 * POST /api/stripe/webhook
 *
 * Mounted with express.raw() BEFORE the global express.json() so the
 * raw bytes survive for HMAC verification. Delegates entirely to
 * stripe-replit-sync — DO NOT add custom logic here. Application-level
 * mirroring (e.g. cached entitlement) reads from the synced stripe.*
 * tables on demand instead.
 */

import { Router, type IRouter, type Request, type Response } from 'express';
import { webhookLimiter } from '../middlewares/rateLimits';
import { db } from '@workspace/db';
import { aforceWebhookDeliveries } from '@workspace/db/schema';
import express from 'express';
import { WebhookHandlers } from '../lib/webhookHandlers';
import { logger } from '../lib/logger';

const router: IRouter = Router();

router.post(
  '/stripe/webhook',
  webhookLimiter,
  // Wave-3 PR6: 1mb — the express.raw default (100kb) 413'd large real
  // payloads, which providers retry into a storm.
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req: Request, res: Response) => {
    const sigHeader = req.headers['stripe-signature'];
    const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature' });
      return;
    }
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, signature);
      // Ack Stripe immediately once the signature-verified sync is done.
      res.status(200).json({ received: true });
      // Linkage repair is a non-critical DB write — run it out of band
      // AFTER the ack so its latency can't delay the response and cause a
      // failed webhook delivery. repairLinkage never throws; the extra
      // .catch is purely defensive.
      void WebhookHandlers.repairLinkage(req.body as Buffer).catch((err) => {
        const msg = err instanceof Error ? err.message : 'linkage_repair_failed';
        logger.warn({ err: msg }, 'Stripe webhook linkage repair failed');
      });
    } catch (err) {
      // Wave-3 PR6: NEVER echo internal error text to an unauthenticated
      // caller (it leaked connector/config state and middleware guidance).
      logger.warn({ err }, 'stripe webhook: verification/processing failed');
      res.status(400).json({ error: 'webhook_verification_failed' });
      return;
    }
    try {
      // Audit ledger (post-verification: the payload survived signature
      // checking inside processWebhook, so event.id is trustworthy).
      const event = JSON.parse((req.body as Buffer).toString('utf8')) as { id?: string; type?: string };
      if (event.id) {
        const inserted = await db
          .insert(aforceWebhookDeliveries)
          .values({ source: 'stripe', deliveryId: event.id, topic: event.type ?? '' })
          .onConflictDoNothing({ target: [aforceWebhookDeliveries.source, aforceWebhookDeliveries.deliveryId] })
          .returning({ id: aforceWebhookDeliveries.id });
        if (inserted.length === 0) {
          logger.info({ eventId: event.id, type: event.type }, 'stripe webhook: duplicate delivery (already processed)');
        }
      }
    } catch (err) {
      logger.debug({ err }, 'stripe webhook: audit-ledger write failed (non-fatal)');
    }
  },
);

export default router;

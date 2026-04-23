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
import express from 'express';
import { WebhookHandlers } from '../lib/webhookHandlers';
import { logger } from '../lib/logger';

const router: IRouter = Router();

router.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sigHeader = req.headers['stripe-signature'];
    const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature' });
      return;
    }
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, signature);
      res.status(200).json({ received: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'webhook_failed';
      logger.warn({ err: msg }, 'Stripe webhook processing failed');
      res.status(400).json({ error: msg });
    }
  },
);

export default router;

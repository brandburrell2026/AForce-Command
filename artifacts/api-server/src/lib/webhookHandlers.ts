/**
 * Stripe webhook delegate. The actual sync is owned by stripe-replit-sync
 * — we only validate that the body arrived as a Buffer (i.e. the route
 * was registered BEFORE express.json()).
 */

import { getStripeSync } from './stripeClient';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        `Received type: ${typeof payload}. ` +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).',
      );
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
}

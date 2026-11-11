import { Router, type IRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { travelFlightRequestSchema, unavailableFlight, type TravelFlightRequest, type TravelFlightResponse } from '@workspace/api-zod';
import { requireRealAuth } from '../middlewares/requireRealAuth';
import { lookupTravelGateFlight } from '../lib/travelGateBridge';

interface Dependencies {
  enabled: () => boolean;
  members: () => ReadonlySet<string>;
  lookup: (request: TravelFlightRequest) => Promise<TravelFlightResponse>;
}
export function buildTravelRouter(deps: Dependencies): IRouter {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
  router.use((req, res, next) => {
    if (!deps.enabled()) { res.status(503).json(unavailableFlight('not_enabled')); return; }
    requireRealAuth(req, res, next);
  });
  router.use((req, res, next) => {
    if (!req.userId || !deps.members().has(req.userId)) { res.status(403).json(unavailableFlight('not_enabled')); return; }
    next();
  });
  router.use(rateLimit({
    windowMs: 60_000, limit: 5, keyGenerator: req => req.userId!,
    standardHeaders: true, legacyHeaders: false,
    handler: (_req, res) => { res.status(429).json(unavailableFlight('rate_limited')); },
  }));
  router.post('/flight-status', async (req, res) => {
    const parsed = travelFlightRequestSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json(unavailableFlight('invalid_response')); return; }
    try { res.json(await deps.lookup(parsed.data)); }
    catch { res.status(502).json(unavailableFlight('provider_unavailable')); }
  });
  return router;
}
export default buildTravelRouter({
  enabled: () => process.env['AFORCE_TRAVEL_ENABLED'] === 'true',
  members: () => new Set((process.env['AFORCE_TRAVEL_MEMBER_IDS'] ?? '').split(',').map(value => value.trim()).filter(Boolean)),
  lookup: input => lookupTravelGateFlight(input, { key: process.env['TRAVELGATE_BRIDGE_KEY'] }),
});

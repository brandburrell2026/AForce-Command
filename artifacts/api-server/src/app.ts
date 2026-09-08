import express, { type Express } from "express";
import { serializeError } from "./lib/serializeError";
import { logger } from "./lib/logger";
import { observeLatency, incCounter } from "./observability/metrics";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import stripeWebhookRouter from "./routes/stripeWebhook";
import shopifyWebhookRouter from "./routes/shopifyWebhook";
import smartCaptureRouter from "./routes/smartCapture";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import { buildCorsOptions } from "./middlewares/corsPolicy";
import { sendApiError, classifyThrown } from "./lib/apiError";

const app: Express = express();

// Trust the Replit proxy so req.ip / X-Forwarded-* are correct for
// rate limiting and logging. One hop only — bumping this higher would
// let clients spoof their IP via XFF.
app.set("trust proxy", 1);

// Security headers. CSP is intentionally off — this is a JSON API
// consumed by Expo + the web preview, not an HTML surface.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk Frontend API proxy must run before any body parser — it
// streams raw bytes through to clerk.dev. No-op outside production.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Stripe webhook — MUST run before express.json() so the raw bytes are
// available to verify the HMAC signature. The router itself attaches
// express.raw({type:'application/json'}) for its single POST route.
app.use("/api", stripeWebhookRouter);
// Shopify webhook (D-2 bridge) — same raw-body-before-json requirement.
app.use("/api", shopifyWebhookRouter);

// Smart Capture — MUST run before the global 64kB express.json() limiter
// because base64-encoded photos are 100kB–6MB and would 413 otherwise.
// The router attaches its own express.json({ limit: '8mb' }) scoped to
// the single POST route, plus per-IP rate limiting for cost control.
//
// ...but its route calls requireAuth -> getAuth(req), and @clerk/express
// THROWS `middlewareRequired("getAuth")` when the request was never
// decorated. Mounted here — above the global clerkMiddleware() below — an
// UNAUTHENTICATED caller therefore got 500 internal_error from the terminal
// error handler instead of 401. Auth still ran (no imagery ever left
// unauthenticated), but the contract was wrong and a client cannot tell a
// refusal from an outage.
//
// The fix is a PATH-SCOPED clerkMiddleware in front of this one router, not
// a relocation of the global mount: moving the router below would put it
// behind the 64kB cap and 413 every real photo, and hoisting the global
// clerkMiddleware above the two webhook routers would newly run Clerk — which
// can set headers and end a response — on the Stripe and Shopify money paths.
// Running it twice on this path is safe by construction: the middleware's
// first line is `if (request.auth) return next()`.
app.use("/api/smart-capture", clerkMiddleware());
app.use("/api", smartCaptureRouter);

// CORS — allowlist driven. In production, set CORS_ALLOWED_ORIGINS to a
// comma-separated list (e.g. "https://app.example.com,https://example.com").
// Never reflect arbitrary origins with credentials in production: that's
// CSRF on a silver platter. Outside production, reflecting every origin
// requires an explicit opt-in (CORS_DEV_REFLECT=1) — see
// `./middlewares/corsPolicy.ts` for the full threat model and
// `.env.example` for the local-dev setup line.
app.use(cors(buildCorsOptions()));
// Explicit body-size cap. The largest legitimate payload is the
// UserState snapshot (~12kB); 64kB leaves headroom without letting a
// malicious client tie up the parser with multi-MB JSON.
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

// clerkMiddleware reads the bearer token / cookie and decorates the
// request with auth context for downstream `getAuth(req)` calls. Safe
// to mount even when CLERK_SECRET_KEY is unset (it just no-ops).
app.use(clerkMiddleware());

// Wave-3 PR9: first wiring of observability/metrics.ts (previously zero
// importers — nothing was measured). Route bucket = first two path
// segments (never ids, never user identity); status class only.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const segments = req.url.split("?")[0]!.split("/").filter(Boolean).slice(0, 2);
    const bucket = segments.join("_") || "root";
    observeLatency(bucket, Date.now() - start);
    incCounter(`requests_total.${bucket}.${Math.floor(res.statusCode / 100)}xx`);
  });
  next();
});

app.use("/api", router);

// JSON 404 for unmatched /api paths. Without this they fall through to
// Express's default handler, which answers with an HTML error page — so a
// client calling an endpoint that does not exist yet (version skew, a typo, a
// route removed) receives HTML where it expects JSON.
//
// SCOPED TO /api DELIBERATELY. Mounting it globally would also swallow
// non-API paths, and this server is not the only thing behind that origin.
//
// POSITION IS LOAD-BEARING: after the router (so every real route still wins)
// and before the error handler (so it is a normal response, not an error).
// It cannot shadow the three routers mounted earlier — stripe webhook, shopify
// webhook, smart capture — because those already matched and responded; a
// request only reaches here when NOTHING matched.
//
// Status is unchanged at 404: the body becomes JSON, the code does not. That
// matters because client code treats 404 as a semantic signal
// (garmin.ts:86, whoopConnect.ts:80, healthConnectionMapping.ts:54).
app.use("/api", (req: express.Request, res: express.Response) => {
  sendApiError(req, res, 404, "not_found");
});

// Wave-3 PR8: the app had NO error middleware — an uncaught route throw
// fell through to Express's default HTML error page, unlogged. Redacted
// structured log + a fixed JSON body (never internal detail).
//
// PR 2: the body now also carries `code` and `requestId`, and a CLOSED
// allowlist of body-parser faults is reported as the client error it actually
// is instead of a blanket 500 (see classifyThrown — it deliberately does not
// trust an arbitrary err.status). The log line is unchanged: still
// serializeError, still never the raw error, and the response never contains
// any part of it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  (req as express.Request & { log?: { error?: (o: unknown, m: string) => void } }).log?.error?.(
    { err: serializeError(err) },
    "unhandled route error",
  );
  logger.error({ err: serializeError(err), url: req.url.split("?")[0] }, "unhandled route error");
  const { status, code } = classifyThrown(err);
  sendApiError(req, res, status, code);
});

export default app;

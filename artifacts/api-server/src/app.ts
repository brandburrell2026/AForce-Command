import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import stripeWebhookRouter from "./routes/stripeWebhook";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";

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

// CORS — allowlist driven. In production, set CORS_ALLOWED_ORIGINS to a
// comma-separated list (e.g. "https://app.example.com,https://example.com").
// In development, reflect the request origin so Expo web previews work
// without per-port config. Never reflect arbitrary origins with
// credentials in production: that's CSRF on a silver platter.
const CORS_ENV = process.env["CORS_ALLOWED_ORIGINS"];
const CORS_ALLOWLIST = CORS_ENV
  ? CORS_ENV.split(",").map((o) => o.trim()).filter(Boolean)
  : null;
const IS_PROD_FOR_CORS = process.env["NODE_ENV"] === "production";
app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl / native fetch
      if (CORS_ALLOWLIST && CORS_ALLOWLIST.length > 0) {
        return cb(null, CORS_ALLOWLIST.includes(origin));
      }
      if (!IS_PROD_FOR_CORS) return cb(null, true);
      return cb(null, false);
    },
  }),
);
// Explicit body-size cap. The largest legitimate payload is the
// UserState snapshot (~12kB); 64kB leaves headroom without letting a
// malicious client tie up the parser with multi-MB JSON.
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

// clerkMiddleware reads the bearer token / cookie and decorates the
// request with auth context for downstream `getAuth(req)` calls. Safe
// to mount even when CLERK_SECRET_KEY is unset (it just no-ops).
app.use(clerkMiddleware());

app.use("/api", router);

export default app;

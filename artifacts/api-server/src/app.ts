import express, { type Express } from "express";
import cors from "cors";
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

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// clerkMiddleware reads the bearer token / cookie and decorates the
// request with auth context for downstream `getAuth(req)` calls. Safe
// to mount even when CLERK_SECRET_KEY is unset (it just no-ops).
app.use(clerkMiddleware());

app.use("/api", router);

export default app;

/**
 * WebSocket hub for AForce OS live updates.
 *
 * A pure pub/sub keyed by userId. Routes call `publish(userId, payload)`
 * after they mutate state and every connected socket for that user
 * receives the JSON payload.
 *
 * Connection URL: `wss://<host>/api/aforce/ws?token=<clerk_jwt>`
 *   - userId is derived from the Clerk session token; the legacy `?user`
 *     query parameter is **not trusted** (would let any client subscribe
 *     to another user's channel — IDOR).
 *   - In dev (no CLERK_SECRET_KEY), falls back to DEFAULT_USER_ID.
 *   - Heartbeat ping every 30s; dead sockets are pruned.
 *
 * The server holds the WebSocketServer in `noServer` mode and the
 * upgrade is wired up from `artifacts/api-server/src/index.ts` so the
 * Express HTTP server and WS share one port.
 */

import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { Server as HttpServer, IncomingMessage } from "node:http";
import { verifyToken } from "@clerk/backend";
import { logger } from "./logger";
import { DEFAULT_USER_ID } from "./aforceState";

const CLERK_SECRET_KEY = process.env["CLERK_SECRET_KEY"];
const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

const wss = new WebSocketServer({ noServer: true });

// userId → set of live sockets
const sockets = new Map<string, Set<WebSocket>>();

function add(userId: string, ws: WebSocket) {
  let set = sockets.get(userId);
  if (!set) {
    set = new Set();
    sockets.set(userId, set);
  }
  set.add(ws);
}

function remove(userId: string, ws: WebSocket) {
  const set = sockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) sockets.delete(userId);
}

export function publish(userId: string, payload: unknown): void {
  const set = sockets.get(userId);
  if (!set || set.size === 0) return;
  const msg = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(msg);
      } catch (err) {
        logger.warn({ err }, "ws send failed");
      }
    }
  }
}

/**
 * Resolve the authenticated userId for an incoming WS upgrade.
 * Returns null when the request must be rejected.
 *
 * Dev fallback (no Clerk secret) returns DEFAULT_USER_ID. In production
 * we *always* require a valid Clerk JWT; an absent or invalid token
 * yields null so the upgrade is denied with 401.
 */
async function authenticateUpgrade(req: IncomingMessage): Promise<string | null> {
  if (!CLERK_SECRET_KEY) {
    if (IS_PRODUCTION) return null;
    return DEFAULT_USER_ID;
  }
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    // Token can come via Sec-WebSocket-Protocol (preferred — no URL leak
    // into proxy logs) or ?token= (Expo can't set custom subprotocols).
    const token =
      url.searchParams.get("token") ??
      (req.headers["sec-websocket-protocol"] as string | undefined)?.split(",")[0]?.trim() ??
      null;
    if (!token) return null;
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    const userId = (payload?.sub as string | undefined) || null;
    return userId && userId.length > 0 ? userId : null;
  } catch (err) {
    logger.warn({ err }, "ws upgrade: token verification failed");
    return null;
  }
}

export function attachAforceHub(server: HttpServer): void {
  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/api/aforce/ws")) {
      // Let other upgrade handlers (if any) deal with it.
      return;
    }
    void authenticateUpgrade(req).then((userId) => {
      if (!userId) {
        // Reject the handshake; client sees a 401 close.
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        add(userId, ws);
        ws.send(JSON.stringify({ type: "hello", userId }));

      // Heartbeat — drop the socket if it doesn't pong back.
      let alive = true;
      ws.on("pong", () => { alive = true; });
      const interval = setInterval(() => {
        if (!alive) {
          ws.terminate();
          return;
        }
        alive = false;
        try { ws.ping(); } catch { /* socket already torn down */ }
      }, 30_000);

      ws.on("message", (data: RawData) => {
        // Clients can send {type:'ping'} as a keepalive on platforms
        // (e.g. RN) where native ping/pong frames aren't accessible.
        try {
          const m = JSON.parse(data.toString());
          if (m?.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", t: Date.now() }));
          }
        } catch { /* ignore non-JSON */ }
      });

      ws.on("close", () => {
        clearInterval(interval);
        remove(userId, ws);
      });

      ws.on("error", (err) => {
        logger.warn({ err }, "ws error");
      });
      });
    });
  });

  logger.info("AForce WS hub attached at /api/aforce/ws");
}

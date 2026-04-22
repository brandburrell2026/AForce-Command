/**
 * WebSocket hub for AForce OS live updates.
 *
 * A pure pub/sub keyed by userId. Routes call `publish(userId, payload)`
 * after they mutate state and every connected socket for that user
 * receives the JSON payload.
 *
 * Connection URL: `ws://<host>/api/aforce/ws?user=<id>`
 *   - `user` defaults to `DEFAULT_USER_ID` (single-user V1)
 *   - Heartbeat ping every 30s; dead sockets are pruned
 *
 * The server holds the WebSocketServer in `noServer` mode and the
 * upgrade is wired up from `artifacts/api-server/src/index.ts` so the
 * Express HTTP server and WS share one port.
 */

import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { Server as HttpServer, IncomingMessage } from "node:http";
import { logger } from "./logger";
import { DEFAULT_USER_ID } from "./aforceState";

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

function parseUserId(req: IncomingMessage): string {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    return url.searchParams.get("user") ?? DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

export function attachAforceHub(server: HttpServer): void {
  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/api/aforce/ws")) {
      // Let other upgrade handlers (if any) deal with it.
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const userId = parseUserId(req);
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

  logger.info("AForce WS hub attached at /api/aforce/ws");
}

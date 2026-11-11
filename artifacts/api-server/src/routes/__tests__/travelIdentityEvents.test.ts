import { afterAll, beforeAll, beforeEach, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import express from "express";
import http from "node:http";
import { buildTravelIdentityEventsRouter } from "../travelIdentityEvents";
const key = Buffer.from("synthetic-webhook-signing-key-32-bytes");
const purge = vi.fn(async () => {});
let server: http.Server, base: string;
beforeAll(async () => {
  const app = express();
  app.use(
    "/events",
    buildTravelIdentityEventsRouter(
      async () => ({ ready: async () => true, purge }) as never,
    ),
  );
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/events`;
});
beforeEach(() => {
  vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", `whsec_${key.toString("base64")}`);
  purge.mockClear();
  purge.mockResolvedValue(undefined);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
const send = (body: string, offset = 0, signatureKey = key) => {
  const id = "msg_synthetic",
    timestamp = String(Math.floor(Date.now() / 1000) + offset);
  const signature = createHmac("sha256", signatureKey)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return fetch(base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`,
    },
    body,
  });
};
it("uses the real Clerk verifier before purging only the deleted identity and is idempotent", async () => {
  const body = JSON.stringify({
    type: "user.deleted",
    data: { id: "user_A", deleted: true, object: "user" },
  });
  expect((await send(body)).status).toBe(200);
  expect(purge).toHaveBeenCalledWith("user_A");
  expect((await send(body)).status).toBe(200);
  expect(purge).toHaveBeenCalledTimes(2);
});
it("refuses forged or expired signatures and unsigned deletion requests", async () => {
  const body = JSON.stringify({ type: "user.deleted", data: { id: "user_A" } });
  expect((await send(body, 0, Buffer.from("wrong-key"))).status).toBe(401);
  expect((await send(body, -600)).status).toBe(401);
  expect(
    (
      await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
    ).status,
  ).toBe(401);
  expect(purge).not.toHaveBeenCalled();
});
it("ignores other signed events and requests provider retry on storage failure", async () => {
  expect(
    (
      await send(
        JSON.stringify({ type: "user.updated", data: { id: "user_A" } }),
      )
    ).status,
  ).toBe(200);
  expect(purge).not.toHaveBeenCalled();
  purge.mockRejectedValue(new Error("unavailable"));
  expect(
    (
      await send(
        JSON.stringify({ type: "user.deleted", data: { id: "user_A" } }),
      )
    ).status,
  ).toBe(503);
});

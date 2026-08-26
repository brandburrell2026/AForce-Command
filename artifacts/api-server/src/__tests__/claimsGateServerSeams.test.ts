/**
 * Wave-2 PR5 — server seam proofs: prohibited claim language is blocked
 * at runtime on the two server text paths.
 *
 *   C7 POST /smart-capture — the only LLM-generated consumer text: a
 *      completion whose free-text carries a block-severity claim is
 *      rejected (502), never relayed.
 *   C2 POST /voice/tts — text carrying a claim is refused (422) before
 *      any ElevenLabs fetch.
 *
 * DB-less lane (smartCaptureAuth pattern).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import type { Server } from "node:http";

vi.mock("../lib/aforceState", () => ({ DEFAULT_USER_ID: "test-default-user" }));
vi.mock("../lib/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

const createMock = vi.fn();
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: { completions: { create: (...a: unknown[]) => createMock(...a) } },
  },
}));

function completionWith(rationale: string) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            itemSummary: "Iced coffee, 16 oz",
            hydrationDemand: { level: "moderate", score: 55, note: "Adds mild fluid demand." },
            recoveryLoad: { level: "low", score: 20, note: "Light load." },
            stimulantLoad: { level: "high", score: 70, note: "Caffeine present." },
            acidicLoad: { level: "moderate", score: 45, note: "Some acidity." },
            correctionRecommendation: {
              drinkCategory: "electrolyte",
              drinkName: "AForce Watermelon",
              oz: 16,
              rationale,
            },
          }),
        },
      },
    ],
  };
}

async function startApp(): Promise<{ server: Server; port: number }> {
  const { default: smartCaptureRouter } = await import("../routes/smartCapture");
  const app = express();
  app.use("/api", smartCaptureRouter);
  return await new Promise((resolvePromise) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolvePromise({ server, port });
    });
  });
}

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("C7 smart-capture — LLM claims fail closed", () => {
  const ENV_KEYS = ["NODE_ENV", "CLERK_SECRET_KEY"] as const;
  let prev: Record<string, string | undefined> = {};
  beforeEach(() => {
    prev = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    // dev lane: requireAuth grants DEFAULT_USER_ID so the seam under test
    // (the claims scrub) is reachable without a Clerk harness.
    process.env["NODE_ENV"] = "test";
    delete process.env["CLERK_SECRET_KEY"];
    createMock.mockReset();
    vi.resetModules();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("a completion whose rationale carries a claim → 502, clean copy → 200", async () => {
    const { server, port } = await startApp();
    try {
      const post = async () =>
        await fetch(`http://127.0.0.1:${port}/api/smart-capture`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageBase64: TINY_PNG_B64, mimeType: "image/png" }),
        });

      createMock.mockResolvedValueOnce(
        completionWith("This drink cures dehydration and prevents injury."),
      );
      const blocked = await post();
      expect(blocked.status).toBe(502);
      const blockedBody = (await blocked.json()) as { error: string };
      expect(blockedBody.error).toContain("unsupported language");

      createMock.mockResolvedValueOnce(
        completionWith("Electrolyte profile fits your current state."),
      );
      const clean = await post();
      expect(clean.status).toBe(200);
    } finally {
      server.close();
    }
  });
});

describe("C2 /voice/tts — claim text refused before synthesis", () => {
  const ENV_KEYS = ["NODE_ENV", "CLERK_SECRET_KEY", "ELEVENLABS_API_KEY"] as const;
  let prev: Record<string, string | undefined> = {};
  const fetchSpy = vi.fn();
  beforeEach(() => {
    prev = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    process.env["NODE_ENV"] = "test";
    delete process.env["CLERK_SECRET_KEY"];
    process.env["ELEVENLABS_API_KEY"] = "test-key";
    vi.resetModules();
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of ENV_KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("blocked text → 422 and ElevenLabs is never called", async () => {
    const { default: voiceRouter } = await import("../routes/voiceTts");
    const app = express();
    app.use(express.json());
    app.use("/api", voiceRouter);
    const server: Server = await new Promise((resolvePromise) => {
      const s = app.listen(0, () => resolvePromise(s));
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      const res = await (globalThis as { fetch: typeof fetch }).fetch;
      void res;
      // use node's undici directly through http to avoid the stubbed fetch:
      const http = await import("node:http");
      const status: number = await new Promise((resolvePromise, reject) => {
        const req = http.request(
          {
            host: "127.0.0.1",
            port,
            path: "/api/voice/tts",
            method: "POST",
            headers: { "content-type": "application/json" },
          },
          (r) => {
            r.resume();
            resolvePromise(r.statusCode ?? 0);
          },
        );
        req.on("error", reject);
        req.end(
          JSON.stringify({
            text: "AForce cures dehydration and predicts injury.",
            voiceId: "voice-12345678",
          }),
        );
      });
      expect(status).toBe(422);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });
});

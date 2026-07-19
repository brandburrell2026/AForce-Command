import { describe, it, expect } from "vitest";
import { serializeError } from "../serializeError";

describe("serializeError", () => {
  it("produces { type, message, stack } from an Error", () => {
    const e = new TypeError("boom");
    const s = serializeError(e);
    expect(s.type).toBe("TypeError");
    expect(s.message).toBe("boom");
    expect(typeof s.stack).toBe("string");
  });

  it("preserves the useful diagnostic text (no token in it)", () => {
    expect(serializeError(new Error("Wrong key or corrupt data")).message).toBe(
      "Wrong key or corrupt data",
    );
    expect(serializeError(new Error("WHOOP refresh failed: HTTP 401")).message).toBe(
      "WHOOP refresh failed: HTTP 401",
    );
  });

  it("redacts a JWT-style token from the message", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc-DEF_123";
    const s = serializeError(new Error(`invalid token: ${jwt}`));
    expect(s.message).toBe("invalid token: [REDACTED_JWT]");
    expect(s.message).not.toContain("eyJ");
  });

  it("redacts a Bearer header", () => {
    expect(serializeError(new Error("header was Bearer sk_live_abcdef123456")).message).toBe(
      "header was Bearer [REDACTED]",
    );
  });

  it("redacts a standalone long opaque token/ciphertext", () => {
    const tok = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0";
    const s = serializeError(new Error(`store said ${tok}`));
    expect(s.message).toContain("[REDACTED]");
    expect(s.message).not.toContain(tok);
  });

  it("handles a non-Error throw", () => {
    const s = serializeError("plain string failure");
    expect(s.type).toBe("unknown_error");
    expect(s.message).toBe("plain string failure");
    expect(s.stack).toBeUndefined();
  });
});

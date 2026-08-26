/**
 * Founding 250 / early-access capture must actually capture, and must tell
 * someone.
 *
 * Source-locked rather than behavioural: the POST handler's body is a
 * Drizzle insert, so exercising it needs a real Postgres and lives in the DB
 * lane. What matters here is wiring — that the notification exists, is
 * addressed where the founder asked, stays fire-and-forget, and that the
 * public site never again reports a signup it did not record.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSrc = readFileSync(resolve(__dirname, "../routes/earlyAccess.ts"), "utf8");
const REPO = resolve(__dirname, "../../../..");
const fnSrc = readFileSync(resolve(REPO, "aforce-site/api/founding-250.js"), "utf8");
const pageSrc = readFileSync(resolve(REPO, "aforce-site/founding-250/index.html"), "utf8");

describe("signup notification", () => {
  it("defaults to the founder's inbox and stays env-overridable", () => {
    expect(routeSrc).toContain('process.env["SIGNUP_NOTIFY_EMAIL"] ?? "info@alkalineforce.com"');
  });

  it("fires only for a genuinely new row, alongside the member confirmation", () => {
    // .returning() is empty on conflict, so a duplicate signup must not
    // re-notify — otherwise a refresh spams the inbox.
    const block = routeSrc.slice(routeSrc.indexOf("if (inserted.length > 0)"));
    expect(block).toContain("sendEarlyAccessConfirmation");
    expect(block).toContain("notifyTeamOfSignup");
  });

  it("is fire-and-forget, so a mail outage cannot fail a signup", () => {
    expect(routeSrc).toContain("sendEmailAndForget");
    expect(routeSrc).not.toMatch(/await\s+sendEmail(?!AndForget)/);
  });

  it("carries the source, so Founding 250 is separable from other signups", () => {
    expect(routeSrc).toMatch(/notifyTeamOfSignup\(parsed\.data\.email, parsed\.data\.source\)/);
  });
});

describe("the Founding 250 form no longer fakes success", () => {
  it("posts to the real endpoint instead of resolving ok locally", () => {
    expect(pageSrc).toContain('fetch("/api/founding-250"');
    expect(pageSrc).not.toContain("return Promise.resolve({ ok: true })");
    expect(pageSrc).not.toContain("[Founding 250 placeholder]");
  });

  it("reports a network failure as a failure", () => {
    // The member must never be told they hold a spot that was never recorded.
    const handler = pageSrc.slice(pageSrc.indexOf("function submitFoundingSignup"));
    expect(handler).toMatch(/catch\s*\(\s*function\s*\(\s*\)\s*\{[\s\S]*?ok:\s*false/);
  });

  it("tags the signup as founding-250 and refuses to invent an ok upstream", () => {
    expect(fnSrc).toContain('source: "founding-250"');
    expect(fnSrc).toMatch(/if \(!upstream\.ok\)/);
    expect(fnSrc).toContain("capture_unavailable");
  });
});

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(), clientQuery: vi.fn(), release: vi.fn(), send: vi.fn(), configured: vi.fn(),
}));
vi.mock("@workspace/db", () => ({ pool: {
  query: mocks.query, connect: async () => ({ query: mocks.clientQuery, release: mocks.release }),
} }));
vi.mock("../lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../lib/signupMicrosoftMail", () => ({
  microsoftSignupMailConfigured: mocks.configured, sendMicrosoftSignupNotification: mocks.send,
}));
import { captureWebsiteSignup, retrySignupNotifications } from "../lib/signupNotifications";

beforeEach(() => { vi.clearAllMocks(); mocks.configured.mockReturnValue(true); });
describe("durable signup notifications", () => {
  it("commits lead and notification together", async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.clientQuery.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [{ id: 42 }] })
      .mockResolvedValueOnce({}).mockResolvedValueOnce({});
    expect(await captureWebsiteSignup("lead@example.com", "homepage")).toBe(true);
    expect(mocks.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN", expect.stringContaining("INSERT INTO early_access_signups"),
      expect.stringContaining("INSERT INTO aforce_signup_notifications"), "COMMIT",
    ]);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("rolls back the signup if notification persistence fails", async () => {
    mocks.clientQuery.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [{ id: 42 }] })
      .mockRejectedValueOnce(new Error("queue write failed")).mockResolvedValueOnce({});
    await expect(captureWebsiteSignup("lead@example.com", "homepage")).rejects.toThrow("queue write failed");
    expect(mocks.clientQuery).toHaveBeenLastCalledWith("ROLLBACK");
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("existing leads enqueue only if they lack a notification, without resending confirmation", async () => {
    mocks.clientQuery.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({}).mockResolvedValueOnce({});
    expect(await captureWebsiteSignup("lead@example.com", "shop-waitlist")).toBe(false);
    expect(mocks.clientQuery).toHaveBeenCalledTimes(4);
    expect(mocks.clientQuery.mock.calls[2][0]).toContain("ON CONFLICT (signup_id) DO NOTHING");
  });
  it("leaves notifications pending when Microsoft is unconfigured", async () => {
    mocks.configured.mockReturnValue(false);
    await retrySignupNotifications();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("marks acceptance only after the provider accepts", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ signup_id: 42, attempts: 1, email: "lead@example.com", source: "aforce-os" }] })
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    mocks.send.mockResolvedValueOnce(undefined);
    await retrySignupNotifications();
    expect(mocks.send).toHaveBeenCalledWith({ id: 42, email: "lead@example.com", source: "aforce-os" });
    expect(mocks.query.mock.calls[1][0]).toContain("accepted_at = now()");
  });
  it("retains a failed notification and schedules another attempt", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ signup_id: 42, attempts: 2, email: "lead@example.com", source: "homepage" }] })
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    mocks.send.mockRejectedValueOnce(new Error("m365_send_http_429"));
    await retrySignupNotifications();
    expect(mocks.query.mock.calls[1][0]).toContain("next_attempt_at = now()");
    expect(mocks.query.mock.calls[1][1]).toEqual([42, 120, "m365_send_http_429"]);
    expect(mocks.query.mock.calls[1][0]).not.toContain("accepted_at = now()");
  });
});

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { sendMicrosoftSignupNotification } from "../lib/signupMicrosoftMail";
const request = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", request); request.mockReset();
  vi.stubEnv("M365_TENANT_ID", "test-tenant"); vi.stubEnv("M365_CLIENT_ID", "test-app");
  vi.stubEnv("M365_CLIENT_SECRET", "test-secret"); vi.stubEnv("M365_SIGNUP_SENDER", "info@alkalineforce.com");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Microsoft 365 internal signup sender", () => {
  it("sends the saved email to the fixed internal recipient as plain text", async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    await sendMicrosoftSignupNotification({ id: 7, email: "lead@example.com", source: "homepage" });
    const [url, options] = request.mock.calls[1];
    expect(url).toBe("https://graph.microsoft.com/v1.0/users/info%40alkalineforce.com/sendMail");
    const body = JSON.parse(options.body);
    expect(body.message.toRecipients).toEqual([{ emailAddress: { address: "info@alkalineforce.com" } }]);
    expect(body.message.body).toEqual({ contentType: "Text", content: expect.stringContaining("lead@example.com") });
    expect(body.saveToSentItems).toBe(true);
  });
  it("fails safely without credentials", async () => {
    vi.stubEnv("M365_CLIENT_SECRET", "");
    await expect(sendMicrosoftSignupNotification({ id: 7, email: "a@example.com", source: "homepage" })).rejects.toThrow("m365_not_configured");
    expect(request).not.toHaveBeenCalled();
  });
  it("does not expose provider bodies or treat a rejection as acceptance", async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("sensitive-provider-detail", { status: 403 }));
    await expect(sendMicrosoftSignupNotification({ id: 7, email: "a@example.com", source: "homepage" })).rejects.toThrow("m365_send_http_403");
  });
});

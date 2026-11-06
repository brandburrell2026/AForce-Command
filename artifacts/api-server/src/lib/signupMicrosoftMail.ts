/** Microsoft 365 is used only for internal website lead notifications. */
export function microsoftSignupMailConfigured(): boolean {
  return ["M365_TENANT_ID", "M365_CLIENT_ID", "M365_CLIENT_SECRET", "M365_SIGNUP_SENDER"]
    .every((key) => Boolean(process.env[key]?.trim()));
}

export async function sendMicrosoftSignupNotification(input: {
  id: number; email: string; source: string;
}): Promise<void> {
  if (!microsoftSignupMailConfigured()) throw new Error("m365_not_configured");
  const tenant = process.env["M365_TENANT_ID"]!;
  if (!/^[a-zA-Z0-9.-]+$/.test(tenant)) throw new Error("m365_invalid_tenant");
  const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env["M365_CLIENT_ID"]!,
      client_secret: process.env["M365_CLIENT_SECRET"]!,
      scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(10000),
  });
  // Never include token responses, credentials, or submitted emails in errors.
  if (!tokenResponse.ok) throw new Error(`m365_token_http_${tokenResponse.status}`);
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) throw new Error("m365_token_missing");
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(process.env["M365_SIGNUP_SENDER"]!)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: `AFORCE website signup #${input.id}`,
          body: { contentType: "Text", content:
            `A website signup was saved.\n\nEmail: ${input.email}\nSource: ${input.source}\nReference: ${input.id}\n` },
          toRecipients: [{ emailAddress: { address: "info@alkalineforce.com" } }],
        },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (response.status !== 202) throw new Error(`m365_send_http_${response.status}`);
  // 202 means Exchange accepted the message; inbox delivery needs message trace.
}

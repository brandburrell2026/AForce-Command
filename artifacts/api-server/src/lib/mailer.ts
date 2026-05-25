/**
 * Tiny transactional-email helper.
 *
 * Supports two providers, picked by which env var is set:
 *   - RESEND_API_KEY      → https://api.resend.com/emails
 *   - SENDGRID_API_KEY    → https://api.sendgrid.com/v3/mail/send
 *
 * If neither is set we log the would-be send and return — callers must treat
 * this as fire-and-forget, so a missing key (or a provider error) never breaks
 * the caller's response.
 *
 * MAIL_FROM controls the From: address; falls back to a placeholder so the
 * provider call still has a sensible value during local development.
 */

import { logger } from "./logger";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const FROM_ADDRESS = process.env["MAIL_FROM"] ?? "AForce <hello@aforce.app>";

async function sendViaResend(
  apiKey: string,
  input: SendEmailInput,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function sendViaSendgrid(
  apiKey: string,
  input: SendEmailInput,
): Promise<void> {
  // Parse "Name <email>" into the v3 mail/send shape; tolerate a bare address.
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(FROM_ADDRESS);
  const from = match
    ? { name: match[1] || undefined, email: match[2]! }
    : { email: FROM_ADDRESS };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from,
      subject: input.subject,
      content: [
        { type: "text/plain", value: input.text },
        { type: "text/html", value: input.html },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`sendgrid ${res.status}: ${body.slice(0, 200)}`);
  }
}

/**
 * Send an email. Resolves on success; rejects on provider error. Callers that
 * want fire-and-forget should wrap with `.catch()` — see `sendEmailAndForget`.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const resendKey = process.env["RESEND_API_KEY"];
  const sendgridKey = process.env["SENDGRID_API_KEY"];

  if (resendKey) {
    await sendViaResend(resendKey, input);
    return;
  }
  if (sendgridKey) {
    await sendViaSendgrid(sendgridKey, input);
    return;
  }

  logger.info(
    { to: input.to, subject: input.subject },
    "sendEmail: no provider configured (RESEND_API_KEY / SENDGRID_API_KEY); skipping",
  );
}

/**
 * Fire-and-forget wrapper. Never throws; logs failures so the caller can
 * always return success to the user even if the mail provider is down.
 */
export function sendEmailAndForget(input: SendEmailInput): void {
  void sendEmail(input).catch((err: unknown) => {
    logger.warn(
      { err, to: input.to, subject: input.subject },
      "sendEmail failed (suppressed)",
    );
  });
}

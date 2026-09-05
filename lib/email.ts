import { siteConfig } from "@/lib/site";

// Transactional email over Resend's REST API.
//
// Deliberately a bare `fetch` rather than the `resend` SDK: one endpoint and
// one JSON body do not justify a dependency, and this keeps the swap to
// Postmark/SES/SMTP a change to one function instead of a package removal.
//
// Email is OPTIONAL *in development*. With no credentials the reset link is
// written to the server log instead of being sent, so `docker compose up` gives
// you a working password reset flow on a fresh clone with nothing to sign up
// for. In production that fallback is refused outright: it would scatter live
// reset tokens through the log aggregator while every user is told mail is "on
// its way" and none of it ever arrives.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Escape before interpolating anything into the HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

async function send({ to, subject, html, text }: SendArgs): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      // Loud, and caught by the caller — the user still gets the same neutral
      // message, but the operator gets a reason instead of silence.
      throw new Error(
        "RESEND_API_KEY / EMAIL_FROM are unset. Refusing to log a live reset " +
          "token in production — configure email, or password reset silently " +
          "does nothing for every user.",
      );
    }
    // Dev fallback. `text` carries the link in full, which is the only part
    // anyone reading a terminal cares about.
    console.info(
      `[email] not configured — would send to ${to}\n  subject: ${subject}\n${text}`,
    );
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    // Node's fetch has no default body timeout: a provider that accepts the
    // connection and then stalls would hold this server action — and the
    // user's form submission — open for minutes.
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    // Body first — Resend puts the actionable part ("domain not verified") in
    // there, and the status alone is rarely enough to fix anything.
    const body = await response.text().catch(() => "");
    throw new Error(
      `Resend rejected the message (${response.status}): ${body.slice(0, 500)}`,
    );
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  /** Lifetime of the link, so the copy cannot drift from the real TTL. */
  ttlSeconds: number,
): Promise<void> {
  const minutes = Math.round(ttlSeconds / 60);
  // Safe today (the token is base64url and the name a constant), escaped anyway
  // so the next person to interpolate a user-supplied value here is not the one
  // who discovers this was raw.
  const href = escapeHtml(resetUrl);
  const product = escapeHtml(siteConfig.name);

  await send({
    to,
    subject: `Reset your ${siteConfig.name} password`,
    text: [
      `Someone asked to reset the password for your ${siteConfig.name} account.`,
      ``,
      `Open this link to choose a new one (valid for ${minutes} minutes):`,
      resetUrl,
      ``,
      `If that wasn't you, ignore this email — your password stays as it is.`,
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#0f172a">
        <h1 style="font-size:20px;margin:0 0 16px">Reset your password</h1>
        <p style="margin:0 0 16px">
          Someone asked to reset the password for your ${product} account.
          Choose a new one with the button below — the link is valid for
          ${minutes} minutes.
        </p>
        <p style="margin:0 0 24px">
          <a href="${href}"
             style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            Reset password
          </a>
        </p>
        <p style="margin:0 0 16px;color:#64748b;font-size:14px">
          If that wasn't you, ignore this email — your password stays as it is.
        </p>
        <p style="margin:0;color:#94a3b8;font-size:12px;word-break:break-all">
          ${href}
        </p>
      </div>
    `,
  });
}

import { isEmailConfigured } from "@/lib/env";
import { siteConfig } from "@/lib/site";
import { humanDuration } from "@/lib/utils";

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

  // Read the body unconditionally: undici holds the connection out of the
  // keep-alive pool until it is consumed or cancelled, so skipping it on the
  // success path leaves reuse to a GC finalizer. It is also where Resend puts
  // the actionable part of a failure ("domain not verified") — the status alone
  // rarely tells you what to fix.
  const body = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(
      `Resend rejected the message (${response.status}): ${body.slice(0, 500)}`,
    );
  }
}

type LinkEmail = {
  to: string;
  subject: string;
  heading: string;
  /** One sentence of context, before the button. */
  lede: string;
  cta: string;
  url: string;
  /** The "wasn't you?" line. Both messages need one; they differ. */
  reassurance: string;
  ttlSeconds: number;
};

/**
 * The one shape of message this app sends: a sentence, a button, and the raw
 * URL underneath for clients that eat buttons.
 *
 * Kept as one function so a second link email is copy rather than layout —
 * getting the inline styles subtly different across messages is how a product
 * starts looking like two products.
 */
async function sendLinkEmail({
  to,
  subject,
  heading,
  lede,
  cta,
  url,
  reassurance,
  ttlSeconds,
}: LinkEmail): Promise<void> {
  const validFor = humanDuration(ttlSeconds);
  // Safe today (the token is base64url and the name a constant), escaped anyway
  // so the next person to interpolate a user-supplied value here is not the one
  // who discovers this was raw.
  const href = escapeHtml(url);

  await send({
    to,
    subject,
    text: [
      lede,
      ``,
      `Open this link (valid for ${validFor}):`,
      url,
      ``,
      reassurance,
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#0f172a">
        <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 16px">
          ${escapeHtml(lede)} The link is valid for ${validFor}.
        </p>
        <p style="margin:0 0 24px">
          <a href="${href}"
             style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            ${escapeHtml(cta)}
          </a>
        </p>
        <p style="margin:0 0 16px;color:#64748b;font-size:14px">
          ${escapeHtml(reassurance)}
        </p>
        <p style="margin:0;color:#94a3b8;font-size:12px;word-break:break-all">
          ${href}
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  /** Lifetime of the link, so the copy cannot drift from the real TTL. */
  ttlSeconds: number,
): Promise<void> {
  await sendLinkEmail({
    to,
    ttlSeconds,
    url: resetUrl,
    subject: `Reset your ${siteConfig.name} password`,
    heading: "Reset your password",
    lede: `Someone asked to reset the password for your ${siteConfig.name} account.`,
    cta: "Reset password",
    reassurance:
      "If that wasn't you, ignore this email — your password stays as it is.",
  });
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
  ttlSeconds: number,
): Promise<void> {
  await sendLinkEmail({
    to,
    ttlSeconds,
    url: verifyUrl,
    subject: `Confirm your email for ${siteConfig.name}`,
    heading: "Confirm your email",
    lede: `Confirm this address to finish setting up your ${siteConfig.name} account.`,
    cta: "Confirm email",
    reassurance:
      "If you didn't create this account, ignore this email and nothing further will happen.",
  });
}

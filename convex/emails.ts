"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import {
  breakoutTitle,
  EVENT,
  formatPeso,
  GROUP_THRESHOLD,
  isExempt,
  ratePerPerson,
  REGISTRATION_TYPES,
  type RegistrationType,
} from "./shared";

const DEFAULT_FROM = "CrossGen Family Summit <onboarding@resend.dev>";

const BRAND = {
  purple: "#402C86",
  purpleDeep: "#2E1F63",
  gold: "#F5B800",
  blue: "#3A97B9",
  orange: "#F2A25C",
  ink: "#1F1B2E",
  muted: "#6B6480",
  line: "#E7E3F0",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function typeLabel(type: RegistrationType, participantCount: number): string {
  if (type === "regular") {
    return participantCount > 1 ? "Group Registration" : "Individual Registration";
  }
  return REGISTRATION_TYPES.find((t) => t.value === type)?.label ?? type;
}

function greetingName(registration: Doc<"registrations">): string {
  const first = registration.registrantName.trim().split(/\s+/)[0];
  return first.length > 0 ? first : "there";
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:6px 0;color:${BRAND.muted};font-size:14px;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:${BRAND.ink};font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
    </tr>`;
}

export function buildConfirmationEmail(
  registration: Doc<"registrations">,
  participants: Doc<"participants">[],
): { subject: string; html: string; text: string } {
  const type = registration.registrationType as RegistrationType;
  const exempt = isExempt(type);
  const label = typeLabel(type, registration.participantCount);

  const paymentBlock = exempt
    ? `<p style="margin:0 0 16px;color:${BRAND.ink};font-size:15px;line-height:1.6;">No payment is required for this registration.</p>`
    : `<p style="margin:0 0 16px;color:${BRAND.ink};font-size:15px;line-height:1.6;">We have also received your submitted proof of payment. This email confirms that we received it — our team will review the details separately.</p>`;

  const participantRows = participants
    .map(
      (p) => `
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${BRAND.line};color:${BRAND.ink};font-size:14px;">
          ${escapeHtml(p.fullName)}
          <div style="color:${BRAND.muted};font-size:13px;margin-top:2px;">${escapeHtml(breakoutTitle(p.breakoutSession))}</div>
        </td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F4FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4FB;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(31,27,46,.08);">

          <tr><td style="background:${BRAND.purple};padding:28px 32px;">
            <div style="color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:-.02em;">CrossGen Family Summit 2026</div>
            <div style="color:${BRAND.gold};font-size:13px;margin-top:4px;">${escapeHtml(EVENT.tagline)}</div>
          </td></tr>

          <tr><td style="padding:32px;">
            <p style="margin:0 0 16px;color:${BRAND.ink};font-size:16px;line-height:1.6;">Hi ${escapeHtml(greetingName(registration))},</p>
            <p style="margin:0 0 16px;color:${BRAND.ink};font-size:15px;line-height:1.6;">Thank you for registering for the CrossGen Family Summit 2026. We have successfully received your registration.</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9FD;border:1px solid ${BRAND.line};border-radius:12px;padding:16px 20px;margin:0 0 20px;">
              <tr><td>
                <div style="color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Registration Number</div>
                <div style="color:${BRAND.purple};font-size:26px;font-weight:700;letter-spacing:-.02em;margin:2px 0 12px;">${escapeHtml(registration.registrationNumber)}</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${registration.groupName ? row("Group", registration.groupName) : ""}
                  ${row("Registration type", label)}
                  ${row("Participants", String(registration.participantCount))}
                  ${
                    exempt
                      ? row("Registration fee", formatPeso(0))
                      : row(
                          `Rate${registration.participantCount >= GROUP_THRESHOLD ? " (group)" : ""}`,
                          `${formatPeso(ratePerPerson(registration.participantCount))} / person`,
                        )
                  }
                  ${exempt ? "" : row("Amount", formatPeso(registration.totalAmount))}
                  ${registration.paymentReference ? row("Payment reference", registration.paymentReference) : ""}
                </table>
              </td></tr>
            </table>

            ${paymentBlock}

            <div style="color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:24px 0 4px;">Participants &amp; breakout sessions</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${participantRows}</table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border-top:3px solid ${BRAND.gold};padding-top:20px;">
              <tr><td>
                <div style="color:${BRAND.ink};font-size:15px;font-weight:700;">${escapeHtml(EVENT.name)}</div>
                <div style="color:${BRAND.muted};font-size:14px;line-height:1.6;margin-top:4px;">
                  ${escapeHtml(EVENT.date)} (${escapeHtml(EVENT.dayOfWeek)})<br />
                  ${escapeHtml(EVENT.venue)}<br />
                  ${escapeHtml(EVENT.address)}
                </div>
              </td></tr>
            </table>

            <p style="margin:24px 0 0;color:${BRAND.muted};font-size:14px;line-height:1.6;">Please keep this email for your records. We look forward to seeing you there!</p>
          </td></tr>

          <tr><td style="background:${BRAND.blue};padding:18px 32px;color:#FFFFFF;font-size:12px;line-height:1.6;">
            PCEC Family Commission<br />
            <span style="opacity:.85;">Sent automatically on registration. Reply to this email if anything looks wrong.</span>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hi ${greetingName(registration)},`,
    "",
    "Thank you for registering for the CrossGen Family Summit 2026!",
    "We have successfully received your registration.",
    "",
    `Registration #: ${registration.registrationNumber}`,
    registration.groupName ? `Group: ${registration.groupName}` : null,
    `Participants: ${registration.participantCount}`,
    `Registration Type: ${label}`,
    exempt
      ? "Registration Fee: ₱0"
      : `Amount: ${formatPeso(registration.totalAmount)}`,
    registration.paymentReference
      ? `Payment Reference: ${registration.paymentReference}`
      : null,
    "",
    exempt
      ? "No payment is required for this registration."
      : "We have also received your submitted proof of payment.",
    "",
    "Participants:",
    ...participants.map(
      (p) => `  - ${p.fullName} — ${breakoutTitle(p.breakoutSession)}`,
    ),
    "",
    "Please keep this email for your records.",
    "",
    EVENT.name,
    `${EVENT.date} (${EVENT.dayOfWeek})`,
    EVENT.venue,
    EVENT.address,
    "",
    "We look forward to seeing you there!",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    subject: `CrossGen 2026 Registration Received — ${registration.registrationNumber}`,
    html,
    text,
  };
}

/**
 * Runs after the registration is already committed. Failure here is recorded on
 * the registration and surfaced to organizers, but never undoes the signup.
 */
export const sendConfirmation = internalAction({
  args: { registrationId: v.id("registrations") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.registrations.getForEmail, {
      registrationId: args.registrationId,
    });
    if (data === null) return;

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey === undefined || apiKey.length === 0) {
      await ctx.runMutation(internal.registrations.recordEmailResult, {
        registrationId: args.registrationId,
        status: "failed",
        error: "RESEND_API_KEY is not configured on this deployment.",
      });
      return;
    }

    const { subject, html, text } = buildConfirmationEmail(
      data.registration,
      data.participants,
    );

    try {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: process.env.RESEND_FROM ?? DEFAULT_FROM,
        to: [data.registration.registrantEmail],
        subject,
        html,
        text,
      });

      if (result.error) {
        await ctx.runMutation(internal.registrations.recordEmailResult, {
          registrationId: args.registrationId,
          status: "failed",
          error: `${result.error.name}: ${result.error.message}`,
        });
        return;
      }

      await ctx.runMutation(internal.registrations.recordEmailResult, {
        registrationId: args.registrationId,
        status: "sent",
        sentAt: Date.now(),
      });
    } catch (error) {
      await ctx.runMutation(internal.registrations.recordEmailResult, {
        registrationId: args.registrationId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

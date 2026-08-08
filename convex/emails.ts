"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import {
  breakoutTitle,
  EVENT,
  formatDatePaid,
  formatPeso,
  GROUP_THRESHOLD,
  isExempt,
  ratePerPerson,
  spellCount,
  typeShort,
  type RegistrationType,
} from "./shared";

const DEFAULT_FROM = "CrossGen Family Summit <onboarding@resend.dev>";

const C = {
  purple: "#3e2a85",
  gold: "#f5b800",
  ink: "#191528",
  muted: "#6e6885",
  line: "#e6e2f0",
  surface: "#faf9fd",
  canvas: "#efedf4",
  tealTint: "#e8f4f8",
  tealInk: "#226f8b",
};

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function siteUrl(): string {
  return (process.env.SITE_URL ?? "https://crossgen.pcecfamily.org").replace(
    /\/$/,
    "",
  );
}

function greetingName(registration: Doc<"registrations">): string {
  const first = registration.registrantName.trim().split(/\s+/)[0];
  return first.length > 0 ? first : "there";
}

/** "Canamo Family, five of you" — how the design describes a registration. */
function groupPhrase(registration: Doc<"registrations">): string {
  const count = registration.participantCount;
  const people = count === 1 ? "just you" : `${spellCount(count)} of you`;
  return registration.groupName
    ? `${registration.groupName}, ${people}`
    : people.charAt(0).toUpperCase() + people.slice(1);
}

function row(label: string, value: string, last = false): string {
  return `<tr>
    <td style="padding:11px 0;border-bottom:${last ? "none" : `1px solid ${C.line}`};font:400 14.5px/1.4 ${SANS};color:${C.muted};">${escapeHtml(label)}</td>
    <td style="padding:11px 0;border-bottom:${last ? "none" : `1px solid ${C.line}`};font:600 14.5px/1.4 ${SANS};color:${C.ink};text-align:right;">${escapeHtml(value)}</td>
  </tr>`;
}

export function buildConfirmationEmail(
  registration: Doc<"registrations">,
  participants: Doc<"participants">[],
): { subject: string; html: string; text: string } {
  const type = registration.registrationType as RegistrationType;
  const exempt = isExempt(type);
  const count = registration.participantCount;
  const grouped = !exempt && count >= GROUP_THRESHOLD;
  const url = `${siteUrl()}/registration/${registration._id}`;

  const preheader = `${registration.registrationNumber} · ${groupPhrase(registration)}`;

  const amountLabel = exempt
    ? formatPeso(0)
    : grouped
      ? `${formatPeso(registration.totalAmount)} at the group rate`
      : `${formatPeso(registration.totalAmount)} · ${formatPeso(ratePerPerson(count))} each`;

  const opening = exempt
    ? `Thanks for signing up for the CrossGen Family Summit. Nothing to pay for a ${typeShort(type).toLowerCase()} registration. Keep this email — your number is how we'll find you at the door.`
    : `Thanks for signing ${count > 1 ? "your family" : "yourself"} up for the CrossGen Family Summit. We've got your receipt too. Keep this email — your number is how we'll find you at the door.`;

  const sessionRows = participants
    .map(
      (p) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid ${C.line};font:500 14.5px/1.4 ${SANS};color:${C.ink};">${escapeHtml(p.fullName)}</td>
        <td style="padding:9px 0;border-bottom:1px solid ${C.line};font:400 13.5px/1.4 ${SANS};color:${C.muted};text-align:right;">${escapeHtml(breakoutTitle(p.breakoutSession))}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:${C.canvas};font-family:${SANS};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};padding:20px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">

          <tr><td style="background:${C.purple};padding:22px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font:700 19px/1 ${SANS};letter-spacing:-.045em;color:#ffffff;">crossgen</td>
              <td style="font:500 12.5px/1 ${SANS};color:rgba(255,255,255,.7);text-align:right;">Family Summit 2026</td>
            </tr></table>
          </td></tr>

          <tr><td style="padding:32px 28px;">
            <h1 style="margin:0 0 22px;font:600 25px/1.25 ${SANS};letter-spacing:-.02em;color:${C.ink};">Hi ${escapeHtml(greetingName(registration))} — you're all set.</h1>
            <p style="margin:0 0 22px;font:400 15.5px/1.65 ${SANS};color:${C.ink};">${escapeHtml(opening)}</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};margin:0 0 22px;">
              ${row("Your number", registration.registrationNumber)}
              ${row(count > 1 ? "Your group" : "Registered", groupPhrase(registration))}
              ${row(exempt ? "Registration fee" : "Sent", amountLabel, registration.datePaid === undefined)}
              ${registration.datePaid ? row("Paid", formatDatePaid(registration.datePaid), true) : ""}
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
              <tr><td style="background:${C.surface};border-radius:12px;padding:18px 20px;">
                <div style="font:600 11.5px/1 ${SANS};letter-spacing:.09em;text-transform:uppercase;color:${C.muted};padding-bottom:6px;">Where to be</div>
                <div style="font:600 15.5px/1.5 ${SANS};color:${C.ink};">${escapeHtml(EVENT.dayOfWeek)}, ${escapeHtml(EVENT.date)}</div>
                <div style="font:400 14.5px/1.5 ${SANS};color:${C.muted};">${escapeHtml(EVENT.venue)}<br />${escapeHtml(EVENT.address)}</div>
              </td></tr>
            </table>

            <div style="font:600 11.5px/1 ${SANS};letter-spacing:.09em;text-transform:uppercase;color:${C.muted};padding-bottom:8px;">${count > 1 ? "Everyone and their sessions" : "Your session"}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};margin:0 0 24px;">
              ${sessionRows}
            </table>

            <p style="margin:0 0 22px;font:400 15.5px/1.65 ${SANS};color:${C.ink};">We can't wait to see you there.</p>

            <a href="${url}" style="display:block;height:48px;line-height:48px;background:${C.gold};color:${C.ink};text-decoration:none;font:600 15px ${SANS};text-align:center;border-radius:12px;">View your registration</a>
            ${
              exempt
                ? ""
                : `<p style="margin:20px 0 0;font:400 13px/1.6 ${SANS};color:${C.muted};">We've received your receipt — the team checks payments by hand, so this isn't confirmation that it has cleared yet.</p>`
            }
          </td></tr>

          <tr><td style="background:${C.tealTint};padding:18px 28px;font:400 12.5px/1.45 ${SANS};color:${C.tealInk};">
            PCEC Family Commission · You're getting this because you registered for CrossGen 2026.
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hi ${greetingName(registration)} — you're all set.`,
    "",
    opening,
    "",
    `Your number: ${registration.registrationNumber}`,
    `${count > 1 ? "Your group" : "Registered"}: ${groupPhrase(registration)}`,
    `${exempt ? "Registration fee" : "Sent"}: ${amountLabel}`,
    registration.paymentReference
      ? `Reference: ${registration.paymentReference}${registration.datePaid ? `, paid ${formatDatePaid(registration.datePaid)}` : ""}`
      : null,
    "",
    "Where to be:",
    `${EVENT.dayOfWeek}, ${EVENT.date}`,
    EVENT.venue,
    EVENT.address,
    "",
    count > 1 ? "Everyone and their sessions:" : "Your session:",
    ...participants.map(
      (p) => `  ${p.fullName} — ${breakoutTitle(p.breakoutSession)}`,
    ),
    "",
    "We can't wait to see you there.",
    "",
    `View your registration: ${url}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    subject: `You're registered for CrossGen 2026 · ${registration.registrationNumber}`,
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

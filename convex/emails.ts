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
  const site = siteUrl();
  const url = `${site}/registration/${registration.registrationNumber}`;

  const preheader = `${registration.registrationNumber} · ${groupPhrase(registration)}`;

  const amountLabel = exempt
    ? "Nothing to pay"
    : grouped
      ? `${formatPeso(registration.totalAmount)} at the group rate`
      : `${formatPeso(registration.totalAmount)} · ${formatPeso(ratePerPerson(count))} each`;

  const opening = exempt
    ? `Salamat! You're on the list for the CrossGen Family Summit as a ${typeShort(type).toLowerCase()}, and there's nothing to pay.`
    : count > 1
      ? "Salamat! Your family is on the list for the CrossGen Family Summit, and we have your receipt."
      : "Salamat! You're on the list for the CrossGen Family Summit, and we have your receipt.";

  const sessionRows = participants
    .map(
      (p, i) => `<tr>
        <td style="padding:10px 0;${i === 0 ? "" : `border-top:1px solid ${C.line};`}font:500 15px/1.4 ${SANS};color:${C.ink};">${escapeHtml(p.fullName)}</td>
        <td style="padding:10px 0;${i === 0 ? "" : `border-top:1px solid ${C.line};`}font:400 13.5px/1.45 ${SANS};color:${C.muted};text-align:right;">${escapeHtml(breakoutTitle(p.breakoutSession))}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:${C.canvas};font-family:${SANS};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};padding:24px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">

          <tr><td style="padding:0;">
            <img src="${site}/brand/header.png" width="560" alt="CrossGen Family Summit 2026" style="display:block;width:100%;height:auto;border:0;" />
          </td></tr>

          <!-- the number is the thing they need on the day, so it leads -->
          <tr><td style="background:${C.purple};padding:26px 28px;">
            <div style="font:600 11.5px/1 ${SANS};letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.6);padding-bottom:8px;">Your number</div>
            <div style="font:700 30px/1 ${SANS};letter-spacing:.01em;color:#ffffff;">${escapeHtml(registration.registrationNumber)}</div>
            <div style="font:400 14px/1.5 ${SANS};color:rgba(255,255,255,.75);padding-top:8px;">Ipakita lang ito sa registration table.</div>
          </td></tr>

          <tr><td style="padding:28px 28px 8px;">
            <h1 style="margin:0 0 14px;font:600 23px/1.3 ${SANS};letter-spacing:-.02em;color:${C.ink};">Hi ${escapeHtml(greetingName(registration))} — you're all set.</h1>
            <p style="margin:0 0 24px;font:400 15.5px/1.65 ${SANS};color:${C.ink};">${escapeHtml(opening)}</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};margin:0 0 24px;">
              ${row(count > 1 ? "Your group" : "Registered", groupPhrase(registration))}
              ${row(exempt ? "Registration fee" : "Sent", amountLabel, registration.datePaid === undefined)}
              ${registration.datePaid ? row("Paid", formatDatePaid(registration.datePaid), true) : ""}
            </table>

            <div style="font:600 11.5px/1 ${SANS};letter-spacing:.09em;text-transform:uppercase;color:${C.muted};padding-bottom:6px;">${count > 1 ? "Everyone and their sessions" : "Your session"}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px;">
              ${sessionRows}
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px;">
              <tr><td style="background:${C.surface};border-radius:14px;padding:20px;">
                <div style="font:600 11.5px/1 ${SANS};letter-spacing:.09em;text-transform:uppercase;color:${C.muted};padding-bottom:8px;">Kita-kita tayo</div>
                <div style="font:600 16px/1.5 ${SANS};color:${C.ink};">${escapeHtml(EVENT.dayOfWeek)}, ${escapeHtml(EVENT.date)}</div>
                <div style="font:400 14.5px/1.5 ${SANS};color:${C.muted};">${escapeHtml(EVENT.venue)}<br />${escapeHtml(EVENT.address)}</div>
              </td></tr>
            </table>

            <!-- padding on the cell, not line-height on the anchor: the
                 line-height trick mis-centres in Gmail and Apple Mail. -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" bgcolor="${C.gold}" style="border-radius:12px;">
                <a href="${url}" style="display:inline-block;padding:16px 28px;font:600 15.5px ${SANS};color:${C.ink};text-decoration:none;">View your registration</a>
              </td></tr>
            </table>
            ${
              exempt
                ? ""
                : `<p style="margin:16px 0 0;font:400 13px/1.6 ${SANS};color:${C.muted};text-align:center;">Your payment is still being reviewed — we'll be in touch if anything is missing.</p>`
            }
          </td></tr>

          <tr><td style="padding:26px 28px 30px;">
            <p style="margin:0;font:400 15.5px/1.65 ${SANS};color:${C.ink};">See you in September!</p>
          </td></tr>

          <tr><td style="background:${C.tealTint};padding:18px 28px;font:400 12.5px/1.5 ${SANS};color:${C.tealInk};">
            PCEC Family Commission · Natanggap mo ito dahil nag-register ka para sa CrossGen 2026.
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
    registration.datePaid ? `Paid: ${formatDatePaid(registration.datePaid)}` : null,
    "",
    "Kita-kita tayo:",
    `${EVENT.dayOfWeek}, ${EVENT.date}`,
    EVENT.venue,
    EVENT.address,
    "",
    count > 1 ? "Everyone and their sessions:" : "Your session:",
    ...participants.map(
      (p) => `  ${p.fullName} — ${breakoutTitle(p.breakoutSession)}`,
    ),
    "",
    `View your registration: ${url}`,
    "",
    "See you in September!",
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

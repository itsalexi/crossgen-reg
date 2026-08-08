"use node";

/**
 * Pushes the whole participant list to the organizers' Google Sheet.
 *
 * The sheet is written by a small Apps Script bound to it, which we POST to.
 * That keeps a Google service-account private key out of this deployment
 * entirely — the only secret here is a shared token the organizers generate,
 * and the script can only ever write to the one sheet it lives in.
 *
 * Set up with:
 *   npx convex env set SHEET_SYNC_URL    https://script.google.com/.../exec
 *   npx convex env set SHEET_SYNC_SECRET <a long random string>
 * See docs/SHEET-SYNC.md for the script and the five clicks around it.
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  breakoutTitle,
  formatDatePaid,
  heardFromLabel,
  typeShort,
  type RegistrationType,
} from "./shared";

const HEADERS = [
  "Registration Number",
  "Source",
  "Group Name",
  "Full Name",
  "Preferred Name",
  "Age",
  "Gender",
  "Marital Status",
  "Church / Organization",
  "Ministry Involvement",
  "Occupation",
  "Mobile Number",
  "Email",
  "City / Municipality",
  "Breakout Session",
  "Registration Type",
  "Payment Type",
  "Payment Reference",
  "Date Paid",
  "Amount",
  "Amount Received",
  "Share Per Person",
  "Receipt",
  "Heard About Us",
  "Photo/Video Consent",
  "Date Registered",
];

export const push = internalAction({
  args: { byEmail: v.string() },
  handler: async (ctx, args): Promise<{ rows: number }> => {
    const url = process.env.SHEET_SYNC_URL;
    const secret = process.env.SHEET_SYNC_SECRET;
    if (!url || !secret) {
      throw new Error(
        "Google Sheet sync is not set up yet — SHEET_SYNC_URL and SHEET_SYNC_SECRET are missing.",
      );
    }

    const data = await ctx.runQuery(internal.registrations.everything, {});
    const received = new Map(
      data.payments.map((p) => [p.reference, p.amountReceived]),
    );

    // A deposit divides by the people it covered — the group rate is per head.
    const peoplePerReference = new Map<string, number>();
    for (const registration of data.registrations) {
      if (registration.paymentType !== "paid") continue;
      const key = (registration.paymentReference ?? "").trim();
      peoplePerReference.set(
        key,
        (peoplePerReference.get(key) ?? 0) + registration.participantCount,
      );
    }
    const shareFor = (reference: string): number | "" => {
      const total = received.get(reference);
      const people = peoplePerReference.get(reference) ?? 0;
      return total === undefined || people === 0
        ? ""
        : Math.round(total / people);
    };

    const byRegistration = new Map<string, typeof data.participants>();
    for (const participant of data.participants) {
      const list = byRegistration.get(participant.registrationId) ?? [];
      list.push(participant);
      byRegistration.set(participant.registrationId, list);
    }

    // One row per participant, oldest first — a sheet reads better appended
    // in the order things happened.
    const rows: (string | number)[][] = [];
    const ordered = [...data.registrations].sort(
      (a, b) =>
        (a.submittedAt ?? a._creationTime) - (b.submittedAt ?? b._creationTime),
    );

    for (const registration of ordered) {
      for (const p of byRegistration.get(registration._id) ?? []) {
        rows.push([
          registration.registrationNumber,
          registration.source === "google-form" ? "Google Form" : "Website",
          registration.groupName ?? "",
          p.fullName,
          p.preferredName ?? "",
          p.age,
          p.gender,
          p.maritalStatus,
          p.churchOrganization,
          p.ministryInvolvement,
          p.occupation,
          p.mobileNumber,
          p.email,
          p.cityMunicipality,
          `${p.breakoutSession}. ${breakoutTitle(p.breakoutSession)}`,
          typeShort(registration.registrationType as RegistrationType),
          registration.paymentType,
          registration.paymentReference ?? "",
          formatDatePaid(registration.datePaid ?? ""),
          registration.amountUnknown === true ? "" : registration.totalAmount,
          received.get((registration.paymentReference ?? "").trim()) ?? "",
          shareFor((registration.paymentReference ?? "").trim()),
          registration.paymentProofExternalUrl ??
            (registration.paymentProofStorageId !== undefined ? "Uploaded" : ""),
          heardFromLabel(registration.heardFrom, registration.heardFromOther),
          registration.consentPhotos === undefined
            ? ""
            : registration.consentPhotos
              ? "Yes"
              : "No",
          new Date(
            registration.submittedAt ?? registration._creationTime,
          ).toISOString(),
        ]);
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        headers: HEADERS,
        rows,
        syncedAt: new Date().toISOString(),
        syncedBy: args.byEmail,
      }),
    });

    // Apps Script answers 200 with an error body rather than a status code,
    // so the body is what actually has to be checked.
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Sheet refused the update (HTTP ${response.status}).`);
    }
    if (!body.includes('"ok"')) {
      throw new Error(`Sheet refused the update: ${body.slice(0, 160)}`);
    }

    return { rows: rows.length };
  },
});

"use node";

/**
 * One-time (but safely repeatable) import of the original Google Form responses.
 *
 * The form was one row per person, so that is exactly how each row lands here:
 * a single-participant registration. No attempt is made to reconstruct groups —
 * the group field was free text written five different ways, and the stated
 * headcounts disagree with the rows actually filled in. Storing what was
 * collected beats storing a reconstruction of it.
 *
 * Run against a deployment with:
 *   npx convex run importGoogleForm:run '{"dryRun":true}'
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { BREAKOUT_SESSIONS, type HeardFrom } from "./shared";

const SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/1xxvA1csO6CBbl7-p14Qr6zkCO4r7x75Q_nfjQIOVgyY/export?format=csv";

/** Minimal RFC 4180 reader — the sheet has quoted fields containing commas. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function breakoutFrom(title: string): 1 | 2 | 3 | 4 | 5 {
  const needle = title.toLowerCase().trim();
  const found = BREAKOUT_SESSIONS.find(
    (s) =>
      s.title.toLowerCase() === needle ||
      needle.startsWith(s.title.toLowerCase().slice(0, 24)),
  );
  return (found?.value ?? 1) as 1 | 2 | 3 | 4 | 5;
}

/**
 * The old form was multi-select with an "other" free-text box, so an answer
 * like "Social Media, Church Announcement" or "Dr. Susan Lim" has no single
 * equivalent here. The raw text is always kept; the enum is a best effort.
 */
function heardFrom(raw: string): { heardFrom: HeardFrom; heardFromOther?: string } {
  const value = raw.toLowerCase();
  const social = value.includes("social media");
  const church = value.includes("church announcement");

  if (social && !church) return { heardFrom: "social-media" };
  if (church && !social) return { heardFrom: "church-announcement" };
  return { heardFrom: "other", heardFromOther: raw.trim() || undefined };
}

/** "7/10/2026" or "7/10/2026 14:24:47" -> "2026-07-10". */
function isoDate(raw: string): string | undefined {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw.trim());
  if (match === null) return undefined;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function timestamp(raw: string): number | undefined {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/.exec(
    raw.trim(),
  );
  if (match === null) return undefined;
  const [, month, day, year, hh = "0", mm = "0", ss = "0"] = match;
  // The form is Philippine time; store the real instant.
  return Date.parse(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hh.padStart(2, "0")}:${mm}:${ss}+08:00`,
  );
}

export const run = internalAction({
  args: { dryRun: v.optional(v.boolean()), csvUrl: v.optional(v.string()) },
  // Annotated because the handler calls back into the generated API, and the
  // inferred type would otherwise reference itself.
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const response = await fetch(args.csvUrl ?? SHEET_CSV);
    if (!response.ok) {
      throw new Error(`Could not read the sheet: HTTP ${response.status}`);
    }

    const [header, ...rows] = parseCsv(await response.text());
    const at = (row: string[], name: string): string => {
      const index = header.findIndex((h) =>
        h.toLowerCase().startsWith(name.toLowerCase()),
      );
      return index === -1 ? "" : (row[index] ?? "").trim();
    };

    const parsed = rows.map((row) => {
      const consentText = at(row, "Column 17");
      const referral = heardFrom(at(row, "How did you hear"));
      const email = at(row, "Email Address").toLowerCase();
      const submitted = at(row, "Timestamp");

      return {
        // Deterministic, so re-running the import cannot duplicate anyone.
        idempotencyKey: `gform:${submitted}:${email}`,
        submittedAt: timestamp(submitted),
        groupName: at(row, "FOR GROUP REGISTRATION") || undefined,
        registrantName: at(row, "Full Name"),
        registrantEmail: email,
        paymentReference: at(row, "Payment Reference Number") || undefined,
        datePaid: isoDate(at(row, "Date Paid")),
        paymentProofExternalUrl: at(row, "Proof of Payment") || undefined,
        consentAccurate: consentText.includes("information provided is accurate"),
        consentDataUse: consentText.includes("collection and use"),
        consentPhotos: consentText.includes("photos/videos"),
        heardFrom: referral.heardFrom,
        heardFromOther: referral.heardFromOther,
        heardFromRaw: at(row, "How did you hear") || undefined,
        participant: {
          fullName: at(row, "Full Name"),
          preferredName: at(row, "Preferred Name") || undefined,
          age: Number.parseInt(at(row, "Age"), 10) || 0,
          gender: at(row, "Gender"),
          maritalStatus: at(row, "Marital Status"),
          churchOrganization: at(row, "Church / Organization"),
          ministryInvolvement: at(row, "Ministry Involvement"),
          occupation: at(row, "Occupation"),
          mobileNumber: at(row, "Mobile Number"),
          email,
          cityMunicipality: at(row, "City / Municipality"),
          breakoutSession: breakoutFrom(at(row, "BREAKOUT SESSION")),
        },
      };
    });

    if (args.dryRun === true) {
      return {
        dryRun: true,
        rows: parsed.length,
        withoutConsentToAll: parsed.filter(
          (r) => !(r.consentAccurate && r.consentDataUse && r.consentPhotos),
        ).length,
        missingReceipt: parsed.filter((r) => r.paymentProofExternalUrl === undefined)
          .length,
        sample: parsed.slice(0, 2),
      };
    }

    return await ctx.runMutation(internal.registrations.importRows, {
      rows: parsed,
    });
  },
});

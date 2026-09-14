"use node";

/**
 * Pushes the whole event to the organizers' Google Sheet, as several tabs.
 *
 * The sheet is written by a small Apps Script bound to it, which we POST to.
 * That keeps a Google service-account private key out of this deployment
 * entirely — the only secret here is a shared token the organizers generate,
 * and the script can only ever write to the one sheet it lives in.
 *
 * One flat dump answered no question without sorting it first, so the same
 * data is shaped several ways instead: a door list, a full roster, rooms,
 * groups, money, and a summary. Each tab answers one question on sight.
 *
 * Anything not named in the payload is left alone, which is what makes the
 * Notes tab safe to type in.
 *
 * Set up with:
 *   npx convex env set SHEET_SYNC_URL    https://script.google.com/.../exec
 *   npx convex env set SHEET_SYNC_SECRET <a long random string>
 * See docs/SHEET-SYNC.md for the script and the five clicks around it.
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { normalizeGroupKey, pickGroupLabel } from "./groupKey";
import {
  BREAKOUT_SESSIONS,
  breakoutTitle,
  EVENT,
  formatDatePaid,
  GROUP_RATE,
  GROUP_THRESHOLD,
  heardFromLabel,
  REGULAR_RATE,
  typeShort,
  type RegistrationType,
} from "./shared";

type Cell = string | number;

/** A field an organizer-entered participant may simply not have. */
function known(value: string | number | undefined): Cell {
  return value ?? "";
}
type Tab = { name: string; headers: string[]; rows: Cell[][] };

/** Columns whose header carries this are formatted as pesos in the sheet. */
const MONEY = "(₱)";

/** "Norberto Torrefranca III" sorts under T. Good enough for a door list. */
function surname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const suffixes = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]);
  for (let i = parts.length - 1; i >= 0; i--) {
    const word = parts[i].toLowerCase();
    if (!suffixes.has(word)) return word;
  }
  return fullName.toLowerCase();
}

function byName(a: { fullName: string }, b: { fullName: string }): number {
  return (
    surname(a.fullName).localeCompare(surname(b.fullName)) ||
    a.fullName.localeCompare(b.fullName)
  );
}

export const push = internalAction({
  args: { byEmail: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ rows: number; tabs: number; sheetSaid: string }> => {
    const url = process.env.SHEET_SYNC_URL;
    const secret = process.env.SHEET_SYNC_SECRET;
    if (!url || !secret) {
      throw new Error(
        "Google Sheet sync is not set up yet — SHEET_SYNC_URL and SHEET_SYNC_SECRET are missing.",
      );
    }

    const data = await ctx.runQuery(internal.registrations.everything, {});
    const paymentFor = new Map(data.payments.map((p) => [p.reference, p]));

    const peopleOf = new Map<string, typeof data.participants>();
    for (const participant of data.participants) {
      const list = peopleOf.get(participant.registrationId) ?? [];
      list.push(participant);
      peopleOf.set(participant.registrationId, list);
    }
    const headcount = (registrationId: string): number =>
      (peopleOf.get(registrationId) ?? []).length;

    // ------------------------------------------------------------- groups

    const keyOf = (r: (typeof data.registrations)[number]): string =>
      r.groupKey ?? normalizeGroupKey(r.groupName ?? "");

    const membersOf = new Map<string, typeof data.registrations>();
    for (const registration of data.registrations) {
      const key = keyOf(registration);
      if (key.length === 0) continue;
      membersOf.set(key, [...(membersOf.get(key) ?? []), registration]);
    }
    const groupLabel = new Map(
      [...membersOf.entries()].map(([key, rows]) => [
        key,
        pickGroupLabel(
          rows.map((r) => (r.groupName ?? "").trim()),
          key,
        ),
      ]),
    );
    const groupSize = new Map(
      [...membersOf.entries()].map(([key, rows]) => [
        key,
        rows.reduce((sum, r) => sum + headcount(r._id), 0),
      ]),
    );

    /**
     * What one person owes. The rate turns on the size of the group they came
     * with, not on how many were on their own registration: two people inside
     * a group of six pay ₱350 each, not ₱450.
     */
    const rateFor = (r: (typeof data.registrations)[number]): number => {
      if (r.paymentType !== "paid") return 0;
      // Charged the group rate at signup on their own word, so that is what
      // they owe. The Groups tab is where an unmet claim gets challenged.
      if (r.joiningGroup === true) return GROUP_RATE;
      const size = groupSize.get(keyOf(r)) ?? headcount(r._id);
      return size >= GROUP_THRESHOLD ? GROUP_RATE : REGULAR_RATE;
    };

    // ----------------------------------------------------------- payments

    const referenceOf = (r: (typeof data.registrations)[number]): string =>
      (r.paymentReference ?? "").trim();

    const onReference = new Map<string, typeof data.registrations>();
    for (const registration of data.registrations) {
      if (registration.paymentType !== "paid") continue;
      const reference = referenceOf(registration);
      onReference.set(reference, [
        ...(onReference.get(reference) ?? []),
        registration,
      ]);
    }

    const expectedOn = new Map<string, number>();
    const peopleOn = new Map<string, number>();
    for (const [reference, rows] of onReference) {
      expectedOn.set(
        reference,
        rows.reduce((sum, r) => sum + headcount(r._id) * rateFor(r), 0),
      );
      peopleOn.set(
        reference,
        rows.reduce((sum, r) => sum + headcount(r._id), 0),
      );
    }

    /**
     * Whether someone can walk in on the day.
     *
     * Deliberately decided on the money rather than on the flag an organizer
     * left: a deposit can be marked "needs sorting" because people are missing
     * from it, which says nothing about whether the person in front of you
     * paid. Ezra's ₱3,500 is flagged for exactly that reason and he is plainly
     * paid up.
     */
    const clearedToAttend = (
      r: (typeof data.registrations)[number],
    ): { cleared: boolean; status: string } => {
      if (r.paymentType !== "paid") {
        return { cleared: true, status: `${typeShort(r.registrationType as RegistrationType)}, no fee` };
      }
      const reference = referenceOf(r);
      const record = paymentFor.get(reference);
      if (record === undefined) {
        return { cleared: false, status: "Not checked against the bank yet" };
      }
      const expected = expectedOn.get(reference) ?? 0;
      if (record.amountReceived >= expected && record.amountReceived > 0) {
        return { cleared: true, status: "Paid" };
      }
      return {
        cleared: false,
        // Named as the deposit's shortfall, not the person's, because one
        // deposit often covers several people and the gap belongs to all of
        // them together.
        status:
          record.amountReceived > 0
            ? `Deposit short by ₱${(expected - record.amountReceived).toLocaleString("en-PH")}`
            : "Nothing received",
      };
    };

    // Oldest first, which is how the roster has always read.
    const ordered = [...data.registrations].sort(
      (a, b) =>
        (a.submittedAt ?? a._creationTime) - (b.submittedAt ?? b._creationTime),
    );

    /** Every person with their registration and payment state attached. */
    const everyone = ordered.flatMap((registration) =>
      (peopleOf.get(registration._id) ?? []).map((participant) => ({
        participant,
        registration,
        group:
          keyOf(registration).length > 0
            ? (groupLabel.get(keyOf(registration)) ?? "")
            : "",
        ...clearedToAttend(registration),
      })),
    );

    // ------------------------------------------------------------- tabs

    const checkIn: Tab = {
      name: "Check-in",
      headers: [
        "Full Name",
        "Goes By",
        "Group",
        "Church / Organization",
        "City / Municipality",
        "Breakout Session",
        "Type",
        "Registration Number",
      ],
      rows: everyone
        .filter((e) => e.cleared)
        .sort((a, b) => byName(a.participant, b.participant))
        .map((e) => [
          e.participant.fullName,
          known(e.participant.preferredName),
          e.group,
          known(e.participant.churchOrganization),
          known(e.participant.cityMunicipality),
          `${e.participant.breakoutSession}. ${breakoutTitle(e.participant.breakoutSession)}`,
          typeShort(e.registration.registrationType as RegistrationType),
          e.registration.registrationNumber,
        ]),
    };

    const participants: Tab = {
      name: "Participants",
      headers: [
        "Registration Number",
        "Source",
        "Group",
        "Group Name As Typed",
        "Full Name",
        "Goes By",
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
        "Payment Status",
        "Payment Reference",
        "Date Paid",
        `Owed ${MONEY}`,
        `Deposit Total, once per reference ${MONEY}`,
        `Share Per Person ${MONEY}`,
        "Receipt",
        "Heard About Us",
        "Photo/Video Consent",
        "Date Registered",
      ],
      rows: [],
    };

    // A deposit covering six people used to print six times, so adding up the
    // column gave four times what the bank holds. Written once now, against
    // the first row that cites it.
    const depositPrinted = new Set<string>();
    for (const entry of everyone) {
      const { participant: p, registration: r } = entry;
      const reference = referenceOf(r);
      const record = paymentFor.get(reference);
      const first = reference.length > 0 && !depositPrinted.has(reference);
      if (first) depositPrinted.add(reference);

      const share =
        record === undefined || (peopleOn.get(reference) ?? 0) === 0
          ? ""
          : Math.round(record.amountReceived / (peopleOn.get(reference) ?? 1));

      participants.rows.push([
        r.registrationNumber,
        r.source === "google-form"
          ? "Google Form"
          : r.source === "organizer"
            ? "Added by organizer"
            : "Website",
        entry.group,
        r.groupName ?? "",
        p.fullName,
        known(p.preferredName),
        known(p.age),
        known(p.gender),
        known(p.maritalStatus),
        known(p.churchOrganization),
        known(p.ministryInvolvement),
        known(p.occupation),
        known(p.mobileNumber),
        known(p.email),
        known(p.cityMunicipality),
        `${p.breakoutSession}. ${breakoutTitle(p.breakoutSession)}`,
        typeShort(r.registrationType as RegistrationType),
        entry.status,
        reference,
        formatDatePaid(r.datePaid ?? ""),
        r.paymentType === "paid" ? rateFor(r) : 0,
        first ? (record?.amountReceived ?? "") : "",
        share,
        r.paymentProofExternalUrl ??
          (r.paymentProofStorageId !== undefined ? "Uploaded" : ""),
        heardFromLabel(r.heardFrom, r.heardFromOther),
        r.consentPhotos === undefined ? "" : r.consentPhotos ? "Yes" : "No",
        new Date(r.submittedAt ?? r._creationTime).toISOString(),
      ]);
    }

    // One block per session, each under its own headcount, so a room can be
    // sized and a roster printed without touching a filter.
    const sessions: Tab = {
      name: "Sessions",
      headers: [
        "Session",
        "Full Name",
        "Group",
        "Church / Organization",
        "City / Municipality",
        "Mobile Number",
        "Coming",
      ],
      rows: [],
    };
    for (const session of BREAKOUT_SESSIONS) {
      const here = everyone
        .filter((e) => e.participant.breakoutSession === session.value)
        .sort((a, b) => byName(a.participant, b.participant));

      sessions.rows.push([
        `${session.value}. ${session.title}`,
        `${here.length} ${here.length === 1 ? "person" : "people"}`,
        "",
        "",
        "",
        "",
        "",
      ]);
      for (const entry of here) {
        sessions.rows.push([
          String(session.value),
          entry.participant.fullName,
          entry.group,
          known(entry.participant.churchOrganization),
          known(entry.participant.cityMunicipality),
          known(entry.participant.mobileNumber),
          entry.cleared ? "Yes" : "Not yet paid",
        ]);
      }
      sessions.rows.push(["", "", "", "", "", "", ""]);
    }

    const groups: Tab = {
      name: "Groups",
      headers: [
        "Group",
        "People",
        `Rate Each ${MONEY}`,
        `Expected ${MONEY}`,
        `Received ${MONEY}`,
        `Gap ${MONEY}`,
        "Payment References",
        "Registrations",
        "Written As",
      ],
      rows: [...membersOf.entries()]
        .map(([key, rows]) => {
          const paying = rows.filter((r) => r.paymentType === "paid");
          const people = groupSize.get(key) ?? 0;
          const references = [...new Set(paying.map(referenceOf))];
          const expected = paying.reduce(
            (sum, r) => sum + headcount(r._id) * rateFor(r),
            0,
          );
          // Split where a deposit reached beyond this group, so nothing is
          // counted twice across the tab.
          const received = references.reduce((sum, reference) => {
            const record = paymentFor.get(reference);
            if (record === undefined) return sum;
            const here = paying
              .filter((r) => referenceOf(r) === reference)
              .reduce((n, r) => n + headcount(r._id), 0);
            const total = peopleOn.get(reference) ?? here;
            return sum + (record.amountReceived / total) * here;
          }, 0);

          return {
            label: groupLabel.get(key) ?? key,
            people,
            rate: paying.length > 0 ? rateFor(paying[0]) : 0,
            expected,
            received: Math.round(received),
            references,
            rows,
          };
        })
        .sort(
          (a, b) =>
            a.received - a.expected - (b.received - b.expected) ||
            b.people - a.people,
        )
        .map((g) => [
          g.label,
          g.people,
          g.rate,
          g.expected,
          g.received,
          g.received - g.expected,
          g.references.join(", "),
          g.rows
            .map((r) => r.registrationNumber)
            .sort()
            .join(", "),
          [
            ...new Set(
              g.rows.map((r) => (r.groupName ?? "").trim()).filter((s) => s),
            ),
          ].join(" | "),
        ]),
    };

    const payments: Tab = {
      name: "Payments",
      headers: [
        "Payment Reference",
        "Status",
        "Date Paid",
        "People Covered",
        `Expected ${MONEY}`,
        `Received ${MONEY}`,
        `Gap ${MONEY}`,
        "Note",
        "Who It Covers",
        "Registrations",
        "Receipt",
      ],
      rows: [...onReference.entries()]
        .map(([reference, rows]) => {
          const record = paymentFor.get(reference);
          const expected = expectedOn.get(reference) ?? 0;
          const received = record?.amountReceived ?? 0;
          const status =
            record === undefined
              ? "Not checked yet"
              : (record.status ?? "received") === "received"
                ? "Received"
                : (record.status ?? "") === "unpaid"
                  ? "Not paid yet"
                  : "Needs sorting";

          return {
            reference: reference.length > 0 ? reference : "(no reference given)",
            status,
            checked: record !== undefined,
            datePaid: formatDatePaid(rows[0].datePaid ?? ""),
            people: peopleOn.get(reference) ?? 0,
            expected,
            received,
            note: record?.note ?? "",
            names: rows
              .flatMap((r) => (peopleOf.get(r._id) ?? []).map((p) => p.fullName))
              .join(", "),
            registrations: rows
              .map((r) => r.registrationNumber)
              .sort()
              .join(", "),
            receipt:
              rows.find((r) => r.paymentProofExternalUrl !== undefined)
                ?.paymentProofExternalUrl ??
              (rows.some((r) => r.paymentProofStorageId !== undefined)
                ? "Uploaded"
                : ""),
          };
        })
        // Anything needing a decision floats to the top.
        .sort(
          (a, b) =>
            Number(a.checked) - Number(b.checked) ||
            a.received - a.expected - (b.received - b.expected) ||
            a.reference.localeCompare(b.reference),
        )
        .map((p) => [
          p.reference,
          p.status,
          p.datePaid,
          p.people,
          p.expected,
          p.received,
          p.received - p.expected,
          p.note,
          p.names,
          p.registrations,
          p.receipt,
        ]),
    };

    // ----------------------------------------------------------- summary

    const tally = (values: string[]): [string, number][] => {
      const counts = new Map<string, number>();
      for (const value of values) {
        const key = value.trim();
        if (key.length === 0) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    };

    const totalExpected = data.registrations.reduce(
      (sum, r) => sum + headcount(r._id) * rateFor(r),
      0,
    );
    const totalReceived = data.payments.reduce(
      (sum, p) => sum + p.amountReceived,
      0,
    );
    // Organizer-entered people often have no age, and averaging them in as
    // zero would drag the figure down. Counted only where it is known.
    const ages = data.participants
      .map((p) => p.age)
      .filter((age): age is number => age !== undefined && age > 0);

    const summary: Tab = {
      name: "Summary",
      headers: [EVENT.name, `${EVENT.date}, ${EVENT.venue}`],
      rows: [
        ["Last synced", new Date().toISOString()],
        ["Synced by", args.byEmail],
        ["", ""],
        ["People registered", data.participants.length],
        ["Registrations", data.registrations.length],
        ["Groups", membersOf.size],
        ["Coming on their own", data.participants.length - everyone.filter((e) => e.group.length > 0).length],
        ["", ""],
        [`Expected ${MONEY}`, totalExpected],
        [`Received ${MONEY}`, totalReceived],
        [`Outstanding ${MONEY}`, Math.max(0, totalExpected - totalReceived)],
        ["Paid up and clear to attend", everyone.filter((e) => e.cleared).length],
        ["Still to settle", everyone.filter((e) => !e.cleared).length],
        ["", ""],
        ["Breakout sessions", ""],
        ...BREAKOUT_SESSIONS.map((session): Cell[] => [
          `  ${session.value}. ${session.title}`,
          data.participants.filter((p) => p.breakoutSession === session.value)
            .length,
        ]),
        ["", ""],
        ["Ages", ""],
        [
          "  Average",
          ages.length > 0
            ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
            : "",
        ],
        [
          "  Under 18",
          data.participants.filter((p) => p.age !== undefined && p.age < 18)
            .length,
        ],
        ["", ""],
        ["Churches", ""],
        ...tally(data.participants.map((p) => p.churchOrganization ?? ""))
          .slice(0, 12)
          .map(([name, count]): Cell[] => [`  ${name}`, count]),
        ["", ""],
        ["Cities", ""],
        ...tally(data.participants.map((p) => p.cityMunicipality ?? ""))
          .slice(0, 12)
          .map(([name, count]): Cell[] => [`  ${name}`, count]),
      ],
    };

    const tabs: Tab[] = [
      summary,
      checkIn,
      participants,
      sessions,
      groups,
      payments,
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        // Kept so a sheet still running the old single-tab script carries on
        // working until its script is replaced.
        headers: participants.headers,
        rows: participants.rows,
        sheets: tabs,
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

    // The sheet's own reply, kept so it is possible to tell which version of
    // the Apps Script answered: the old one counts rows, the new one tabs.
    return {
      rows: participants.rows.length,
      tabs: tabs.length,
      sheetSaid: body.slice(0, 200),
    };
  },
});

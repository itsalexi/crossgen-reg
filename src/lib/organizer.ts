import type { Doc } from "@convex/_generated/dataModel";
import {
  BREAKOUT_SESSIONS,
  heardFromLabel,
  type RegistrationType,
} from "@convex/shared";

export type Registration = Doc<"registrations">;
export type Participant = Doc<"participants">;

export type Row = {
  registration: Registration;
  participants: Participant[];
};

/** One participant with its registration attached, for the flat people view. */
export type PersonRow = {
  participant: Participant;
  registration: Registration;
};

export type PaymentFilter = "" | "paid" | "exempt" | "receipt-missing";
export type EmailFilter = "" | "sent" | "failed" | "pending";

export type Filters = {
  search: string;
  type: "" | RegistrationType;
  session: "" | number;
  payment: PaymentFilter;
  email: EmailFilter;
  church: string;
  city: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_FILTERS: Filters = {
  search: "",
  type: "",
  session: "",
  payment: "",
  email: "",
  church: "",
  city: "",
  dateFrom: "",
  dateTo: "",
};

export function filtersActive(filters: Filters): boolean {
  return (Object.keys(filters) as (keyof Filters)[]).some(
    (key) => String(filters[key]).length > 0,
  );
}

function dayStart(value: string): number | undefined {
  if (value.length === 0) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function dayEnd(value: string): number | undefined {
  if (value.length === 0) return undefined;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

export function receiptMissing(registration: Registration): boolean {
  return (
    registration.paymentType === "paid" &&
    registration.paymentProofStorageId === undefined
  );
}

export function buildRows(
  registrations: Registration[],
  participants: Participant[],
): Row[] {
  const byRegistration = new Map<string, Participant[]>();
  for (const participant of participants) {
    const list = byRegistration.get(participant.registrationId) ?? [];
    list.push(participant);
    byRegistration.set(participant.registrationId, list);
  }

  return registrations.map((registration) => ({
    registration,
    participants: byRegistration.get(registration._id) ?? [],
  }));
}

function matchesRegistrationOnly(row: Row, filters: Filters): boolean {
  const { registration } = row;

  if (filters.type.length > 0 && registration.registrationType !== filters.type) {
    return false;
  }

  if (filters.payment === "paid" && registration.paymentType !== "paid") return false;
  if (filters.payment === "exempt" && registration.paymentType !== "exempt") {
    return false;
  }
  if (filters.payment === "receipt-missing" && !receiptMissing(registration)) {
    return false;
  }

  if (filters.email.length > 0 && registration.confirmationEmailStatus !== filters.email) {
    return false;
  }

  const from = dayStart(filters.dateFrom);
  if (from !== undefined && registration._creationTime < from) return false;
  const to = dayEnd(filters.dateTo);
  if (to !== undefined && registration._creationTime > to) return false;

  return true;
}

function personMatches(
  participant: Participant,
  registration: Registration,
  filters: Filters,
): boolean {
  if (filters.session !== "" && participant.breakoutSession !== filters.session) {
    return false;
  }
  if (
    filters.church.length > 0 &&
    participant.churchOrganization.toLowerCase() !== filters.church.toLowerCase()
  ) {
    return false;
  }
  if (
    filters.city.length > 0 &&
    participant.cityMunicipality.toLowerCase() !== filters.city.toLowerCase()
  ) {
    return false;
  }

  const search = filters.search.toLowerCase().trim();
  if (search.length > 0) {
    const haystack = [
      participant.fullName,
      participant.preferredName ?? "",
      participant.email,
      participant.mobileNumber,
      participant.churchOrganization,
      participant.cityMunicipality,
      registration.registrationNumber,
      registration.groupName ?? "",
      registration.registrantEmail,
      registration.paymentReference ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  return true;
}

/**
 * A registration survives if it matches and at least one of its people does —
 * and it comes back carrying only the people who matched. Filtering "session 2"
 * should show the two people in that session, not the whole family they came
 * with, and every count downstream follows from this one narrowing.
 */
export function filterRows(rows: Row[], filters: Filters): Row[] {
  const kept: Row[] = [];
  for (const row of rows) {
    if (!matchesRegistrationOnly(row, filters)) continue;
    const participants = row.participants.filter((p) =>
      personMatches(p, row.registration, filters),
    );
    if (participants.length === 0) continue;
    kept.push({ registration: row.registration, participants });
  }
  return kept;
}

export function filterPeople(rows: Row[], filters: Filters): PersonRow[] {
  return filterRows(rows, filters).flatMap((row) =>
    row.participants.map((participant) => ({
      participant,
      registration: row.registration,
    })),
  );
}

// -------------------------------------------------------------------- stats

export type Stats = {
  registrations: number;
  participants: number;
  amount: number;
  paidRegistrations: number;
  exemptParticipants: number;
  receiptsAttached: number;
  receiptsMissing: number;
  emailsFailed: number;
  bySession: { value: number; title: string; count: number }[];
  byType: { type: RegistrationType; count: number }[];
  byChurch: { name: string; count: number }[];
  byCity: { name: string; count: number }[];
  averageAge: number | null;
  minors: number;
  byHeardFrom: { name: string; count: number }[];
};

function tally(values: string[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (key.length === 0) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function computeStats(rows: Row[]): Stats {
  const people = rows.flatMap((row) => row.participants);
  const ages = people.map((p) => p.age).filter((age) => Number.isFinite(age));

  const byTypeMap = new Map<RegistrationType, number>();
  for (const row of rows) {
    const type = row.registration.registrationType as RegistrationType;
    byTypeMap.set(type, (byTypeMap.get(type) ?? 0) + row.participants.length);
  }

  return {
    registrations: rows.length,
    participants: people.length,
    amount: rows.reduce((sum, row) => sum + row.registration.totalAmount, 0),
    paidRegistrations: rows.filter((r) => r.registration.paymentType === "paid")
      .length,
    exemptParticipants: rows
      .filter((r) => r.registration.paymentType === "exempt")
      .reduce((sum, r) => sum + r.participants.length, 0),
    receiptsAttached: rows.filter(
      (r) => r.registration.paymentProofStorageId !== undefined,
    ).length,
    receiptsMissing: rows.filter((r) => receiptMissing(r.registration)).length,
    emailsFailed: rows.filter(
      (r) => r.registration.confirmationEmailStatus === "failed",
    ).length,
    bySession: BREAKOUT_SESSIONS.map((session) => ({
      value: session.value,
      title: session.title,
      count: people.filter((p) => p.breakoutSession === session.value).length,
    })),
    byType: [...byTypeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    byChurch: tally(people.map((p) => p.churchOrganization)),
    byCity: tally(people.map((p) => p.cityMunicipality)),
    averageAge:
      ages.length > 0
        ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
        : null,
    minors: people.filter((p) => p.age < 18).length,
    // Counted per registration — one answer is given for the whole group.
    byHeardFrom: tally(
      rows
        .filter((row) => row.registration.heardFrom !== undefined)
        .map((row) =>
          heardFromLabel(row.registration.heardFrom, row.registration.heardFromOther),
        ),
    ),
  };
}

export function uniqueValues(
  rows: Row[],
  pick: (participant: Participant) => string,
): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const participant of row.participants) {
      const value = pick(participant).trim();
      if (value.length > 0) set.add(value);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

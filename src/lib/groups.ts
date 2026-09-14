/**
 * Who came with whom.
 *
 * The group field was free text, so the same group was written five ways:
 * "Salumbides Family", "Salumbides Family - 5 members", "Salumbides-5". None of
 * that is a key. This normalises the spellings into one, and — because the
 * label is only ever a claim — lets an organizer pin a registration into a
 * group by hand, which then wins over whatever was typed.
 *
 * Money is deliberately kept separate from membership. A payment reference is
 * hard evidence that people paid together; a typed label is not evidence of
 * anything. Where the two disagree, both are shown rather than reconciled.
 */

import { GROUP_RATE, GROUP_THRESHOLD, REGULAR_RATE } from "@convex/shared";
import {
  displayName,
  normalizeGroupKey,
  pickGroupLabel,
  statedSize,
} from "@convex/groupKey";
import {
  referenceOf,
  type Payment,
  type Registration,
  type Row,
} from "./organizer";

export { displayName, normalizeGroupKey, statedSize };

export type GroupDecision = {
  groupKey: string;
  kind: GroupIssue["kind"];
  note?: string;
  byEmail: string;
};

/**
 * The group a registration belongs to. An organizer's pin wins over the typed
 * label; an empty pin means "this one stands alone", which is the only way to
 * pull a row out of a group it was typed into.
 */
export function groupKeyOf(registration: Registration): string {
  if (registration.groupKey !== undefined) return registration.groupKey;
  return normalizeGroupKey(registration.groupName ?? "");
}

// ---------------------------------------------------------------- grouping

export type GroupReference = {
  reference: string;
  /** People on this reference who are in this group. */
  peopleHere: number;
  /** People on this reference in total, whichever group they are in. */
  peopleTotal: number;
  record: Payment | undefined;
};

/** Something worth saying about a group that nobody has to act on. */
export type GroupFlag = {
  key: string;
  tone: "warn" | "info";
  text: string;
};

/**
 * Something somebody has to do something about, in the order they should do it.
 *
 * Money that never arrived comes first because it is the only one where the
 * event is out of pocket. Money that arrived for people who never registered
 * comes next — those are seats nobody has claimed. A headcount that fell short
 * of the label is third: it may only mean the rest are still coming.
 */
export type GroupIssue = {
  kind: "short" | "over" | "missing" | "unchecked";
  rank: number;
  /** Sorts groups of the same kind: pesos for money, people for the rest. */
  weight: number;
  text: string;
};

function peso(amount: number): string {
  return `₱${Math.round(amount).toLocaleString("en-PH")}`;
}

export type Group = {
  key: string;
  label: string;
  /** Every distinct way the name was typed, for the ones that were. */
  spellings: string[];
  rows: Row[];
  people: number;
  paidPeople: number;
  /** Rows an organizer put here by hand rather than by what was typed. */
  pinned: number;
  /** Rows that claimed the group rate while registering separately. */
  claimedGroupRate: number;
  statedSize: number | null;
  references: GroupReference[];
  /** ₱350 once the group is five or more, ₱450 below that. */
  rate: number;
  expected: number;
  received: number;
  /** True when a deposit here also covered people outside this group. */
  approximate: boolean;
  /** True when every reference in the group has been checked against the bank. */
  allChecked: boolean;
  /** Worst first. Empty means nothing to do. */
  issues: GroupIssue[];
  /** Raised once, then settled by an organizer. Kept visible, quietly. */
  settled: (GroupIssue & { byEmail: string; note?: string })[];
  flags: GroupFlag[];
};

export function worstIssue(group: Group): GroupIssue | undefined {
  return group.issues[0];
}

/**
 * What each person owes, and so what the event is owed in total.
 *
 * The rate turns on the size of the group someone came with, not on how many
 * were named on their own registration: two people inside a group of six pay
 * ₱350 each, not ₱450. That distinction is the whole reason this cannot be
 * read off a single registration, and why the imported Google Form rows —
 * one person each, all of them part of some larger group — have no amount
 * stored against them.
 */
export function expectedRates(allRows: Row[]) {
  const sizeOfGroup = new Map<string, number>();
  for (const row of allRows) {
    const key = groupKeyOf(row.registration);
    if (key.length === 0) continue;
    sizeOfGroup.set(
      key,
      (sizeOfGroup.get(key) ?? 0) + row.participants.length,
    );
  }

  const rateFor = (row: Row): number => {
    if (row.registration.paymentType !== "paid") return 0;
    // Someone who told us at signup that they are joining a group registering
    // separately was charged ₱350 on the spot. Expecting ₱450 from them here
    // would contradict the figure the form gave them, and they would look
    // short for paying exactly what they were asked.
    if (row.registration.joiningGroup === true) return GROUP_RATE;
    const key = groupKeyOf(row.registration);
    const size =
      key.length > 0
        ? (sizeOfGroup.get(key) ?? row.participants.length)
        : row.participants.length;
    return size >= GROUP_THRESHOLD ? GROUP_RATE : REGULAR_RATE;
  };

  return {
    rateFor,
    expectedFor: (row: Row): number => row.participants.length * rateFor(row),
    totalFor: (rows: Row[]): number =>
      rows.reduce((sum, row) => sum + row.participants.length * rateFor(row), 0),
  };
}

/**
 * @param rows      the rows on screen, after filters
 * @param allRows   every row, used only to see how far a deposit reached
 * @param decisions flags an organizer has already settled
 */
export function buildGroups(
  rows: Row[],
  allRows: Row[],
  payments: Payment[],
  decisions: GroupDecision[] = [],
): { groups: Group[]; alone: Row[] } {
  const recordFor = new Map(payments.map((p) => [p.reference, p]));
  const settledFor = new Map<string, GroupDecision>(
    decisions.map((d) => [`${d.groupKey}:${d.kind}`, d]),
  );

  // How many people each deposit covered in total — the divisor for a shared
  // reference, and the reason a group's share can be less than the full amount.
  const coverage = new Map<string, number>();
  for (const row of allRows) {
    if (row.registration.paymentType !== "paid") continue;
    const key = referenceOf(row.registration);
    coverage.set(key, (coverage.get(key) ?? 0) + row.participants.length);
  }

  const buckets = new Map<string, Row[]>();
  const alone: Row[] = [];
  for (const row of rows) {
    const key = groupKeyOf(row.registration);
    if (key.length === 0) {
      alone.push(row);
      continue;
    }
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }

  const groups = [...buckets.entries()].map(([key, group]) => {
    const labels = group
      .map((r) => (r.registration.groupName ?? "").trim())
      .filter((label) => label.length > 0);

    // Same choice the Google Sheet mirror makes, so both call it one name.
    const label = pickGroupLabel(labels, key);

    const stated = labels.reduce<number | null>((best, current) => {
      const value = statedSize(current);
      if (value === null) return best;
      return best === null ? value : Math.max(best, value);
    }, null);

    const people = group.reduce((sum, r) => sum + r.participants.length, 0);
    const paying = group.filter((r) => r.registration.paymentType === "paid");
    const paidPeople = paying.reduce(
      (sum, r) => sum + r.participants.length,
      0,
    );

    const byReference = new Map<string, number>();
    for (const row of paying) {
      const reference = referenceOf(row.registration);
      byReference.set(
        reference,
        (byReference.get(reference) ?? 0) + row.participants.length,
      );
    }
    const references: GroupReference[] = [...byReference.entries()]
      .map(([reference, peopleHere]) => ({
        reference,
        peopleHere,
        peopleTotal: coverage.get(reference) ?? peopleHere,
        record: recordFor.get(reference),
      }))
      .sort((a, b) => b.peopleHere - a.peopleHere);

    // The rate is per head and turns on the size of the group, so this is the
    // one place the group view can say something the per-registration view
    // cannot: a family of two inside a group of six pays ₱350, not ₱450.
    const rate = paidPeople >= GROUP_THRESHOLD ? GROUP_RATE : REGULAR_RATE;
    const expected = paidPeople * rate;

    // A shared deposit is split by the people it covered — the same arithmetic
    // the group rate is built on. Never summed twice.
    let received = 0;
    let approximate = false;
    for (const entry of references) {
      const amount = entry.record?.amountReceived ?? 0;
      if (entry.peopleTotal > entry.peopleHere) {
        approximate = true;
        received += (amount / entry.peopleTotal) * entry.peopleHere;
      } else {
        received += amount;
      }
    }
    received = Math.round(received);

    const allChecked =
      references.length > 0 && references.every((r) => r.record !== undefined);

    const gap = received - expected;
    const missing = stated === null ? 0 : Math.max(0, stated - people);
    const unchecked = references.filter((r) => r.record === undefined).length;

    // Only the things somebody has to act on. More people than the label
    // claimed is not one of them: the label was written before everyone had
    // registered, and the money follows the heads, not the claim.
    const issues: GroupIssue[] = [];
    if (allChecked && gap < 0) {
      issues.push({
        kind: "short",
        rank: 0,
        weight: -gap,
        text: `${peso(-gap)} short of ₱${rate} × ${paidPeople}`,
      });
    }
    if (allChecked && gap > 0) {
      issues.push({
        kind: "over",
        rank: 1,
        weight: gap,
        // Overpaid almost always means people paid for have not registered.
        text: `${peso(gap)} more than the ${paidPeople} registered here`,
      });
    }
    if (missing > 0) {
      issues.push({
        kind: "missing",
        rank: 2,
        weight: missing,
        text: `${missing} of the ${stated} they named never registered`,
      });
    }
    const claimed = group.filter(
      (r) => r.registration.joiningGroup === true,
    ).length;
    if (claimed > 0 && people < GROUP_THRESHOLD) {
      issues.push({
        kind: "missing",
        rank: 2,
        weight: GROUP_THRESHOLD - people,
        text: `${claimed} paid the group rate but only ${people} registered, ${GROUP_THRESHOLD} needed`,
      });
    }
    if (unchecked > 0) {
      issues.push({
        kind: "unchecked",
        rank: 3,
        weight: unchecked,
        text: `${unchecked} deposit${unchecked === 1 ? "" : "s"} not checked against the bank`,
      });
    }
    issues.sort((a, b) => a.rank - b.rank);

    // Anything an organizer has already looked at and closed stops counting as
    // a problem, but stays on the card so the decision is visible.
    const settled: Group["settled"] = [];
    const live: GroupIssue[] = [];
    for (const issue of issues) {
      const decision = settledFor.get(`${key}:${issue.kind}`);
      if (decision === undefined) live.push(issue);
      else
        settled.push({
          ...issue,
          byEmail: decision.byEmail,
          note: decision.note,
        });
    }

    // Worth saying, not worth doing anything about.
    const flags: GroupFlag[] = [];
    if (stated !== null && people > stated) {
      flags.push({
        key: "stated",
        tone: "info",
        text: `${people - stated} more than the label says`,
      });
    }
    if (approximate) {
      flags.push({
        key: "shared",
        tone: "info",
        text: "Shares a deposit with people outside this group",
      });
    }
    if (references.length > 1) {
      flags.push({
        key: "refs",
        tone: "info",
        text: `${references.length} payment references`,
      });
    }

    return {
      key,
      label,
      spellings: [...new Set(labels)],
      rows: group,
      people,
      paidPeople,
      pinned: group.filter((r) => r.registration.groupKey !== undefined).length,
      claimedGroupRate: group.filter(
        (r) => r.registration.joiningGroup === true,
      ).length,
      statedSize: stated,
      references,
      rate,
      expected,
      received,
      approximate,
      allChecked,
      issues: live,
      settled,
      flags,
    } satisfies Group;
  });

  // Worst problem first, biggest of its kind first, and everything settled
  // falls to the bottom in size order.
  groups.sort((a, b) => {
    const first = worstIssue(a);
    const second = worstIssue(b);
    if (first === undefined && second === undefined) {
      return b.people - a.people || a.label.localeCompare(b.label);
    }
    if (first === undefined) return 1;
    if (second === undefined) return -1;
    return (
      first.rank - second.rank ||
      second.weight - first.weight ||
      a.label.localeCompare(b.label)
    );
  });

  return { groups, alone };
}

export type GroupSummary = {
  groups: number;
  grouped: number;
  alone: number;
  needsALook: number;
  /** Pesos missing across every group whose deposits have all been checked. */
  shortfall: number;
};

export function summarize(groups: Group[], alone: Row[]): GroupSummary {
  return {
    groups: groups.length,
    grouped: groups.reduce((sum, g) => sum + g.people, 0),
    alone: alone.reduce((sum, r) => sum + r.participants.length, 0),
    needsALook: groups.filter((g) => g.issues.length > 0).length,
    shortfall: groups.reduce(
      (sum, g) => sum + (g.issues.find((i) => i.kind === "short")?.weight ?? 0),
      0,
    ),
  };
}

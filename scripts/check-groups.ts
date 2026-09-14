/**
 * Prints the groups the dashboard will show, from a Convex export, so the
 * numbers on every card can be read before anyone relies on them.
 *
 * The tallying here is written independently of src/lib/groups.ts on purpose —
 * agreeing with a copy of itself would prove nothing. Only the key normaliser
 * is shared, because that is the part being trusted.
 *
 *   npx convex export --path /tmp/snap --prod
 *   node --experimental-strip-types scripts/check-groups.ts /tmp/snap
 */

import { readFileSync } from "node:fs";
import { displayName, normalizeGroupKey, statedSize } from "../convex/groupKey.ts";

type Json = Record<string, any>;

const dir = process.argv[2] ?? "/tmp/snap";
const read = (name: string): Json[] =>
  readFileSync(`${dir}/${name}/documents.jsonl`, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));

const registrations = read("registrations");
const participants = read("participants");
const payments = read("payments");

const peopleOf = new Map<string, Json[]>();
for (const person of participants) {
  peopleOf.set(person.registrationId, [
    ...(peopleOf.get(person.registrationId) ?? []),
    person,
  ]);
}
const paymentFor = new Map(payments.map((p) => [p.reference, p]));
const headcount = (r: Json): number => (peopleOf.get(r._id) ?? []).length;
const refOf = (r: Json): string =>
  (r.paymentReference ?? "").trim() || "(no reference)";

// People per deposit, across everyone — the divisor for a shared reference.
const coverage = new Map<string, number>();
for (const r of registrations) {
  if (r.paymentType !== "paid") continue;
  coverage.set(refOf(r), (coverage.get(refOf(r)) ?? 0) + headcount(r));
}

const buckets = new Map<string, Json[]>();
const alone: Json[] = [];
for (const r of registrations) {
  const key =
    r.groupKey !== undefined ? r.groupKey : normalizeGroupKey(r.groupName ?? "");
  if (key.length === 0) alone.push(r);
  else buckets.set(key, [...(buckets.get(key) ?? []), r]);
}

const peso = (n: number) => `P${Math.round(n).toLocaleString("en-US")}`;

const cards = [...buckets.entries()].map(([key, group]) => {
  const labels = group
    .map((r) => (r.groupName ?? "").trim())
    .filter((l) => l.length > 0);
  const people = group.reduce((sum, r) => sum + headcount(r), 0);
  const paying = group.filter((r) => r.paymentType === "paid");
  const paidPeople = paying.reduce((sum, r) => sum + headcount(r), 0);

  const refs = new Map<string, number>();
  for (const r of paying) refs.set(refOf(r), (refs.get(refOf(r)) ?? 0) + headcount(r));

  let received = 0;
  let shared = false;
  let unchecked = 0;
  for (const [reference, here] of refs) {
    const record = paymentFor.get(reference);
    if (record === undefined) unchecked += 1;
    const total = coverage.get(reference) ?? here;
    const amount = record?.amountReceived ?? 0;
    if (total > here) {
      shared = true;
      received += (amount / total) * here;
    } else received += amount;
  }

  const rate = paidPeople >= 5 ? 350 : 450;
  const stated = labels
    .map(statedSize)
    .filter((v): v is number => v !== null)
    .reduce<number | null>((a, b) => (a === null ? b : Math.max(a, b)), null);

  return {
    key,
    label:
      labels.length > 0 ? displayName(labels.sort((a, b) => a.length - b.length)[0]) : key,
    people,
    paidPeople,
    stated,
    rate,
    expected: paidPeople * rate,
    received: Math.round(received),
    shared,
    unchecked,
    refs: [...refs.keys()],
    rows: group.map((r) => r.registrationNumber).sort(),
  };
});

/** Same order the page uses: worst kind first, biggest of that kind first. */
const issuesOf = (card: (typeof cards)[number]) => {
  const found: { rank: number; weight: number; text: string }[] = [];
  const gap = card.received - card.expected;
  if (card.unchecked === 0 && gap < 0) {
    found.push({ rank: 0, weight: -gap, text: `${peso(-gap)} SHORT` });
  }
  if (card.unchecked === 0 && gap > 0) {
    found.push({ rank: 1, weight: gap, text: `${peso(gap)} OVER` });
  }
  const missing = card.stated === null ? 0 : Math.max(0, card.stated - card.people);
  if (missing > 0) {
    found.push({
      rank: 2,
      weight: missing,
      text: `${missing} of ${card.stated} never registered`,
    });
  }
  if (card.unchecked > 0) {
    found.push({
      rank: 3,
      weight: card.unchecked,
      text: `${card.unchecked} deposit unchecked`,
    });
  }
  return found.sort((a, b) => a.rank - b.rank);
};

cards.sort((a, b) => {
  const first = issuesOf(a)[0];
  const second = issuesOf(b)[0];
  if (first === undefined && second === undefined) return b.people - a.people;
  if (first === undefined) return 1;
  if (second === undefined) return -1;
  return first.rank - second.rank || second.weight - first.weight;
});

console.log(
  `${cards.length} groups, ${cards.reduce((s, c) => s + c.people, 0)} people grouped, ` +
    `${alone.reduce((s, r) => s + headcount(r), 0)} on their own\n`,
);

for (const card of cards) {
  const notes = issuesOf(card).map((issue) => issue.text);
  if (card.stated !== null && card.people > card.stated) {
    notes.push(`(${card.people - card.stated} more than the label says)`);
  }
  if (card.shared) notes.push("(shared deposit)");
  if (card.refs.length > 1) notes.push(`(${card.refs.length} refs)`);

  console.log(
    `${card.label.padEnd(34)} ${String(card.people).padStart(2)} people  ` +
      `${card.shared ? "~" : " "}${peso(card.received).padStart(7)} of ${peso(card.expected).padEnd(7)} @${card.rate}` +
      (notes.length > 0 ? `   << ${notes.join("; ")}` : ""),
  );
  console.log(`${"".padEnd(34)} ${card.rows.join(", ")}`);
  console.log(`${"".padEnd(34)} ${card.refs.join(", ")}`);
}

/**
 * Runs the group-name normaliser over every label that actually exists and
 * prints the buckets it produces, so they can be read and checked by eye.
 *
 * Labels come from a Convex export, or from the built-in list of what was in
 * production on 19 Aug 2026 if no export is given:
 *
 *   npx convex export --path /tmp/snap --prod
 *   node --experimental-strip-types scripts/check-group-keys.ts /tmp/snap
 */

import { readFileSync } from "node:fs";
import { displayName, normalizeGroupKey, statedSize } from "../convex/groupKey.ts";

/** Every distinct group name in production on 19 Aug 2026, with its row count. */
const KNOWN: [string, number][] = [
  ["ACD Group", 1],
  ["Amazing-GCF South Metro", 1],
  ["Arriola Family - 4 pax", 1],
  ["BSOTEAM", 1],
  ["BSOTEAM - 7 participants", 6],
  ["Balangue Family", 1],
  ["CLPMI", 4],
  ["DJ-GCFSM", 2],
  ["DJ-GCFSM (5)", 2],
  ["DJ-GCFSM- 18", 1],
  ["Family", 1],
  ["Family Builders Core (5)", 4],
  ["Family Builders Core - (5)", 1],
  ["Francia Family GG", 1],
  ["Group Juan", 1],
  ["Group Juan (5 members)", 1],
  ["Group Juan (Total of 5)", 1],
  ["Group Juan (total of 5)", 2],
  ["Group Name: CLPMI, Total number of participants: 5", 1],
  ["MCNJ GCF South Metro", 1],
  ["NIKKIE Ramos Group", 1],
  ["NIkkie Ramos Group", 1],
  ["NLIC Carmona", 1],
  ["Nano-Estrella-Villacorta Families", 7],
  ["Nikkie Ramos - 5 pax", 1],
  ["Nikkie Ramos Group", 1],
  ["Nikkie Ramos' Group", 1],
  ["Pineda FAMILY", 1],
  ["Rodriguez fam 4pax", 1],
  ["Salumbides Family", 1],
  ["Salumbides Family - 5 Participants", 1],
  ["Salumbides Family - 5 members", 2],
  ["Salumbides-5", 1],
  ["Torrefranca", 1],
  ["Torrefranca group , 5 participants", 1],
  ["Torrefranca. Group - 5 participants", 1],
  ["Transformed by Grace 1", 1],
  ["UR GG-5  5 participants", 1],
  ["URGG-5", 4],
  ["UpperRoom-7", 7],
];

function fromExport(dir: string): [string, number][] {
  const counts = new Map<string, number>();
  for (const line of readFileSync(
    `${dir}/registrations/documents.jsonl`,
    "utf8",
  ).split("\n")) {
    if (line.trim().length === 0) continue;
    const label = (JSON.parse(line).groupName ?? "").trim();
    if (label.length > 0) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const dir = process.argv[2];
const labels = dir === undefined ? KNOWN : fromExport(dir);

const buckets = new Map<string, [string, number][]>();
for (const entry of labels) {
  const key = normalizeGroupKey(entry[0]);
  buckets.set(key, [...(buckets.get(key) ?? []), entry]);
}

const sorted = [...buckets.entries()].sort(
  (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
);

console.log(`${labels.length} distinct labels -> ${sorted.length} groups\n`);
for (const [key, entries] of sorted) {
  const rows = entries.reduce((sum, e) => sum + e[1], 0);
  const stated = entries
    .map((e) => statedSize(e[0]))
    .filter((v): v is number => v !== null);
  const claim = stated.length > 0 ? Math.max(...stated) : null;
  console.log(
    `${key.padEnd(24)} shown as "${displayName(entries[0][0])}"  ${rows} row${rows === 1 ? "" : "s"}${claim !== null ? `, label says ${claim}` : ""}`,
  );
  for (const [label, count] of entries) {
    console.log(`    ${String(count).padStart(2)} x ${JSON.stringify(label)}`);
  }
}

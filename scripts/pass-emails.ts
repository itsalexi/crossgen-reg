/**
 * Builds the mail-merge sheet for the door passes.
 *
 * Mailmeteor sends one email per row, so the rows are one per *address*, not
 * one per person. Several people share an inbox — a coordinator holds 39
 * attendees, couples share one address — and a row per person would post 39
 * separate emails into the same inbox.
 *
 * A participant's own address wins. Where they have none, their codes go to
 * whoever filed the registration, so somebody can print them.
 *
 *   npx convex export --path /tmp/snap --prod
 *   mkdir -p /tmp/snapd && unzip -oq /tmp/snap -d /tmp/snapd
 *   node --experimental-strip-types scripts/pass-emails.ts /tmp/snapd > /tmp/passes.csv
 *
 * Then: open /tmp/passes.csv, import into a Google Sheet, and point Mailmeteor
 * at it. Merge fields are the column headers.
 */

import { readFileSync } from "node:fs";

const SITE = "https://crossgen.pcecfamily.org";

import { breakoutRoom, breakoutTitle } from "../convex/shared.ts";

type Row = Record<string, string>;

const dir = process.argv[2];
if (dir === undefined) {
  console.error("Pass the path to an unzipped Convex export.");
  process.exit(1);
}

const read = (name: string): Record<string, any>[] =>
  readFileSync(`${dir}/${name}/documents.jsonl`, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));

const registrations = new Map(
  read("registrations").map((r) => [r._id, r]),
);
const participants = read("participants");

const valid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

type Person = {
  id: string;
  name: string;
  first: string;
  workshop: string;
  room: { room: string; colour: string } | null;
  registrationNumber: string;
  group: string;
  ownEmail: boolean;
};

const byAddress = new Map<string, Person[]>();
const unreachable: Person[] = [];

for (const participant of participants) {
  const registration = registrations.get(participant.registrationId);
  if (registration === undefined) continue;
  // A sponsor seat nobody has claimed has no name and nobody to send to.
  if (participant.seat === true && String(participant.fullName).trim() === "") {
    continue;
  }

  const own = String(participant.email ?? "").trim().toLowerCase();
  const filer = String(registration.registrantEmail ?? "").trim().toLowerCase();
  const email = valid(own) ? own : valid(filer) ? filer : "";

  const person: Person = {
    id: participant._id,
    name: String(participant.fullName).trim(),
    first: String(participant.fullName).trim().split(/\s+/)[0],
    workshop: breakoutTitle(participant.breakoutSession),
    room: breakoutRoom(participant.breakoutSession),
    registrationNumber: registration.registrationNumber,
    group: String(registration.groupName ?? "").trim(),
    ownEmail: valid(own),
  };

  if (email.length === 0) {
    unreachable.push(person);
    continue;
  }
  byAddress.set(email, [...(byAddress.get(email) ?? []), person]);
}

const rows: Row[] = [...byAddress.entries()]
  .map(([email, people]) => {
    const numbers = [...new Set(people.map((p) => p.registrationNumber))];
    // Mailmeteor renders HTML in a merge field, so the links can be real links
    // rather than a wall of pasted URLs.
    const linksHtml = people
      .map(
        (person) =>
          `<a href="${SITE}/pass/${person.id}">${person.name}</a> — ${person.workshop}` +
          (person.room === null
            ? ""
            : ` — ${person.room.room} (${person.room.colour.toLowerCase()} sign)`),
      )
      .join("<br>");
    // One line per row: a newline inside a CSV field is legal but makes the
    // file impossible to check by eye before sending 431 emails.
    const linksText = people
      .map((person) => `${person.name}: ${SITE}/pass/${person.id}`)
      .join("  |  ");

    return {
      Email: email,
      Greeting: people[0].first,
      People: String(people.length),
      Names: people.map((p) => p.name).join(", "),
      PassLinks: linksHtml,
      PassLinksPlain: linksText,
      // Only meaningful when everything in this inbox is one registration.
      AllCodesLink:
        numbers.length === 1 ? `${SITE}/passes/${numbers[0]}` : "",
      RegistrationNumbers: numbers.join(", "),
      Group: people[0].group,
    };
  })
  .sort((a, b) => Number(b.People) - Number(a.People));

const headers = Object.keys(rows[0]);
const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
console.log(headers.map(escape).join(","));
for (const row of rows) {
  console.log(headers.map((h) => escape(row[h] ?? "")).join(","));
}

const covered = [...byAddress.values()].reduce(
  (total, people) => total + people.length,
  0,
);
console.error(`${rows.length} emails covering ${covered} people`);
console.error(
  `${rows.filter((r) => Number(r.People) > 1).length} of those carry more than one code`,
);
if (unreachable.length > 0) {
  console.error(`\nNo address at all, print these from /passes/<number>:`);
  for (const person of unreachable) {
    console.error(`  ${person.name} — ${person.registrationNumber}`);
  }
}

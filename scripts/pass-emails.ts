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
    // Codes are drawn into the email only where they can be drawn big enough
    // to scan off a screen. Past a handful, shrinking them to fit is the worst
    // of both: a long email full of squares nobody can read.
    //
    // A coordinator gets the useful thing instead — a line per person with
    // their room and their own link to forward, and a page holding every code
    // at full size for printing or for showing at the door.
    const SHOW_CODES_UP_TO = 4;
    const drawn = people.length <= SHOW_CODES_UP_TO;

    const card = (person: Person): string =>
      `<div style="padding:0 0 22px">` +
      `<div style="font-size:16px;font-weight:bold;color:#191528">${person.name}</div>` +
      (person.room === null
        ? ""
        : `<div style="font-size:14px;color:#4a4460;padding-bottom:8px">${person.room.room} — ${person.room.colour.toLowerCase()} sign</div>`) +
      `<img src="${SITE}/qr/${person.id}.png" alt="Check-in code for ${person.name}" width="200" height="200" style="display:block;border:1px solid #e6e2f0">` +
      `</div>`;

    const listRow = (person: Person): string =>
      `<tr>` +
      `<td valign="top" style="padding:8px 12px 8px 0;border-bottom:1px solid #f0edf6">` +
      `<div style="font-size:15px;font-weight:bold;color:#191528">${person.name}</div>` +
      (person.room === null
        ? ""
        : `<div style="font-size:13px;color:#4a4460">${person.room.room} — ${person.room.colour.toLowerCase()} sign</div>`) +
      `</td>` +
      `<td valign="top" align="right" style="padding:8px 0;border-bottom:1px solid #f0edf6;white-space:nowrap">` +
      `<a href="${SITE}/pass/${person.id}" style="font-size:14px;color:#3e2a85">Buksan ang code</a>` +
      `</td></tr>`;

    // One page per registration, holding every code on it at full size.
    const pages = numbers
      .map(
        (number) =>
          `<a href="${SITE}/passes/${number}" style="color:#3e2a85">${number}</a>`,
      )
      .join(" &middot; ");

    const qrHtml = drawn
      ? people.map(card).join("")
      : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">` +
        people.map(listRow).join("") +
        `</table>` +
        `<p style="margin:16px 0 0;font-size:14px;color:#4a4460">` +
        `Lahat ng code sa isang pahina, pwedeng i-print: ${pages}</p>`;

    // The copy has to say a different thing to somebody holding one code and
    // somebody holding twenty. "Screenshot your QR code" is wrong advice for
    // a coordinator who has to hand them out.
    const intro =
      people.length === 1
        ? `Narito na ang iyong QR code. I-screenshot mo ito dahil kailangan mo ito ` +
          `para makapasok sa summit venue.`
        : drawn
          ? `Narito ang QR codes ng ${people.length} taong nakarehistro sa iyo. ` +
            `I-screenshot o i-forward sa bawat isa ang sarili niyang code.`
          : `Nakarehistro sa iyo ang ${people.length} katao. Pakisuyong i-forward sa ` +
            `bawat isa ang sarili niyang link sa ibaba — doon niya makikita ang ` +
            `sarili niyang QR code. Pwede mo ring i-print ang buong listahan.`;

    // One line per row: a newline inside a CSV field is legal but makes the
    // file impossible to check by eye before sending 431 emails.
    const linksText = people
      .map((person) => `${person.name}: ${SITE}/pass/${person.id}`)
      .join("  |  ");

    return {
      Email: email,
      // Greeting the first name in the list is right for the 374 rows that
      // are one person, and wrong for a coordinator holding twenty: they are
      // not Jerayah. Their group is the truer address, and where an inbox
      // spans several groups there is no name that fits.
      Greeting:
        people.length === 1
          ? people[0].first
          : new Set(people.map((person) => person.group)).size === 1 &&
              people[0].group.length > 0
            ? people[0].group
            : "CrossGen family",
      People: String(people.length),
      Names: people.map((p) => p.name).join(", "),
      PassLinks: linksHtml,
      QrCodes: qrHtml,
      Intro: intro,
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

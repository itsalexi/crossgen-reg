import type { Doc } from "@convex/_generated/dataModel";
import { breakoutRoom, breakoutTitle } from "@convex/shared";

/**
 * The mail-merge sheet, built in the browser.
 *
 * This used to be a script somebody ran from the repository with a database
 * export beside it, which meant every blast went through whoever had the
 * terminal. The commission sends its own post now, so it is a button.
 *
 * One row per address, never one per person: several people share an inbox,
 * and a coordinator holding thirty would otherwise get thirty emails.
 */

const SITE = "https://crossgen.pcecfamily.org";
const SHOW_CODES_UP_TO = 4;

const valid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

type Person = {
  id: string;
  name: string;
  first: string;
  workshop: string;
  room: { room: string; colour: string } | null;
  registrationNumber: string;
  group: string;
};

export function buildMailMergeCsv(
  registrations: Doc<"registrations">[],
  participants: Doc<"participants">[],
): string {
  const byId = new Map(registrations.map((r) => [r._id, r]));
  const byAddress = new Map<string, Person[]>();

  for (const participant of participants) {
    const registration = byId.get(participant.registrationId);
    if (registration === undefined) continue;
    // A seat nobody has claimed has no name and nobody to send to.
    if (participant.seat === true && participant.fullName.trim().length === 0) {
      continue;
    }

    const own = (participant.email ?? "").trim().toLowerCase();
    const filer = registration.registrantEmail.trim().toLowerCase();
    const to = valid(own) ? own : valid(filer) ? filer : "";
    if (to.length === 0) continue;

    const name = participant.fullName.trim();
    byAddress.set(to, [
      ...(byAddress.get(to) ?? []),
      {
        id: participant._id,
        name,
        first: name.split(/\s+/)[0]?.replace(/,$/, "") ?? name,
        workshop: breakoutTitle(participant.breakoutSession),
        room: breakoutRoom(participant.breakoutSession),
        registrationNumber: registration.registrationNumber,
        group: (registration.groupName ?? "").trim(),
      },
    ]);
  }

  const rows = [...byAddress.entries()]
    .map(([email, people]) => {
      const numbers = [...new Set(people.map((p) => p.registrationNumber))];
      const many = people.length > 1;
      const drawn = people.length <= SHOW_CODES_UP_TO;

      const card = (person: Person) =>
        `<div style="padding:0 0 22px">` +
        `<div style="font-size:16px;font-weight:bold;color:#191528">${person.name}</div>` +
        (person.room === null
          ? ""
          : `<div style="font-size:14px;color:#4a4460;padding-bottom:8px">${person.room.room} — ${person.room.colour.toLowerCase()} sign</div>`) +
        `<img src="${SITE}/qr/${person.id}.png" alt="Check-in code for ${person.name}" width="200" height="200" style="display:block;border:1px solid #e6e2f0">` +
        `</div>`;

      const links = people
        .map(
          (person) =>
            `<a href="${SITE}/pass/${person.id}" style="color:#3e2a85">${person.name}</a>`,
        )
        .join(", ");

      const listRows = people
        .map(
          (person) =>
            `<tr><td valign="top" style="padding:8px 12px 8px 0;border-bottom:1px solid #f0edf6">` +
            `<div style="font-size:15px;font-weight:bold;color:#191528">${person.name}</div>` +
            (person.room === null
              ? ""
              : `<div style="font-size:13px;color:#4a4460">${person.room.room} — ${person.room.colour.toLowerCase()} sign</div>`) +
            `</td><td valign="top" align="right" style="padding:8px 0;border-bottom:1px solid #f0edf6;white-space:nowrap">` +
            `<a href="${SITE}/pass/${person.id}" style="font-size:14px;color:#3e2a85">Buksan ang code</a>` +
            `</td></tr>`,
        )
        .join("");

      const pages = numbers
        .map(
          (number) =>
            `<a href="${SITE}/passes/${number}" style="color:#3e2a85">${number}</a>`,
        )
        .join(" &middot; ");

      const qrCodes = drawn
        ? people.map(card).join("") +
          `<p style="margin:12px 0 0;font-size:14px;color:#4a4460">Hindi lumalabas ang larawan? Buksan ang code dito: ${links}</p>`
        : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">${listRows}</table>` +
          `<p style="margin:16px 0 0;font-size:14px;color:#4a4460">Lahat ng code sa isang pahina: ${pages}</p>`;

      return {
        Email: email,
        Greeting: !many
          ? people[0].first
          : new Set(people.map((p) => p.group)).size === 1 &&
              people[0].group.length > 0
            ? people[0].group
            : "CrossGen family",
        People: String(people.length),
        Names: people.map((p) => p.name).join(", "),
        QrCodes: qrCodes,
        PassLinks: links,
        AllCodesLink: numbers.length === 1 ? `${SITE}/passes/${numbers[0]}` : "",
        RegistrationNumbers: numbers.join(", "),
        Group: people[0].group,
      };
    })
    .sort((a, b) => Number(b.People) - Number(a.People));

  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [
    headers.map(cell).join(","),
    ...rows.map((row) =>
      headers.map((h) => cell((row as Record<string, string>)[h] ?? "")).join(","),
    ),
  ].join("\n");
}

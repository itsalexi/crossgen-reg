/**
 * Builds a re-send sheet for just the people who changed.
 *
 * The blast went out on 21 September. Everything corrected since — a mistyped
 * address, a substitution, a group repointed at its real coordinator — means
 * somebody is holding a code that is wrong, or holding none at all. Re-running
 * all 431 would mail everybody twice; this picks out only the inboxes that
 * need it.
 *
 *   npx convex export --path /tmp/snap --prod
 *   mkdir -p /tmp/snapd && unzip -oq /tmp/snap -d /tmp/snapd
 *   node --experimental-strip-types scripts/resend.ts /tmp/snapd CG26-00071 GF26-00018 > /tmp/resend.csv
 *
 * Takes registration numbers, email addresses, or both. For a registration it
 * finds whoever actually receives those people's codes, which is not always
 * anyone on the registration.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [dir, ...targets] = process.argv.slice(2);
if (dir === undefined || targets.length === 0) {
  console.error(
    "Usage: resend.ts <unzipped-export-dir> <registration-number|email> ...",
  );
  process.exit(1);
}

const read = (name: string): Record<string, any>[] =>
  readFileSync(`${dir}/${name}/documents.jsonl`, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));

const registrations = read("registrations");
const participants = read("participants");
const valid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Which inboxes carry the people we care about. Same rule the mail merge uses:
// a person's own address wins, otherwise whoever filed the registration.
const wanted = new Set<string>();
const numbers = new Set(
  targets.filter((t) => !t.includes("@")).map((t) => t.trim().toUpperCase()),
);
for (const target of targets) {
  if (target.includes("@")) wanted.add(target.trim().toLowerCase());
}

for (const registration of registrations) {
  if (!numbers.has(String(registration.registrationNumber).toUpperCase())) {
    continue;
  }
  const people = participants.filter(
    (p) => p.registrationId === registration._id,
  );
  for (const person of people) {
    const own = String(person.email ?? "").trim().toLowerCase();
    const filer = String(registration.registrantEmail ?? "")
      .trim()
      .toLowerCase();
    const to = valid(own) ? own : valid(filer) ? filer : "";
    if (to.length > 0) wanted.add(to);
    else {
      console.error(
        `  no address for ${person.fullName} (${registration.registrationNumber}) — print /passes/${registration.registrationNumber}`,
      );
    }
  }
}

// Rather than duplicate the merge, run the real builder and keep the rows we
// want. One definition of what an email looks like, not two.
const full = execFileSync(
  "node",
  ["--experimental-strip-types", "scripts/pass-emails.ts", dir],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
);

const lines = full.split("\n").filter((line) => line.trim().length > 0);
const header = lines[0];
const emailAt = header
  .split(",")
  .findIndex((column) => column.replace(/"/g, "") === "Email");

const kept = lines.slice(1).filter((line) => {
  // The Email column is first and never contains a comma, so this is safe.
  const cells = line.split(",");
  const email = (cells[emailAt] ?? "").replace(/"/g, "").toLowerCase();
  return wanted.has(email);
});

console.log(header);
for (const line of kept) console.log(line);
console.error(`${kept.length} rows for ${wanted.size} addresses`);
for (const address of wanted) {
  if (!kept.some((line) => line.toLowerCase().includes(address))) {
    console.error(`  ${address} is not in the merge — nothing to send it`);
  }
}

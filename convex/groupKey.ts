/**
 * Turning a typed group name into a key.
 *
 * This is a first guess, not the answer. The group field was free text and the
 * same group was written five ways — "Salumbides Family", "Salumbides Family -
 * 5 members", "Salumbides-5" — so something has to make the obvious matches for
 * free. Everything it gets wrong is corrected by an organizer pinning the
 * registration to a group by hand, which overrides this entirely.
 *
 * Lives here rather than in src/ because both sides need the same answer: the
 * dashboard groups by it, and the mutation that pins a registration normalises
 * through it before writing.
 *
 * Kept import-free so it can be run over the real labels and checked:
 *   node --experimental-strip-types scripts/check-group-keys.ts
 */

/**
 * Strips the headcount people tacked onto the name — "(5)", "- 7 participants",
 * "Total number of participants: 5", "-18". Run before punctuation is flattened,
 * because the brackets and separators are what make these findable.
 */
const COUNT_CLAUSES: RegExp[] = [
  /\bgroup\s*name\s*[:=]\s*/gi,
  /[,;-]?\s*\btotal\s*(?:number\s*of\s*)?(?:participants?|members?|pax)?\s*[:=]?\s*(\d+)\b/gi,
  /\(\s*(?:a\s+)?(?:total\s+of\s+)?(\d+)\s*(?:members?|participants?|pax|people|persons?)?\s*\)/gi,
  /[,;-]?\s*(\d+)\s*(?:members?|participants?|pax|people|persons?)\b/gi,
];

/** The trailing "-5" in "Salumbides-5" or "UpperRoom-7". */
const TRAILING_NUMBER = /[\s-]+(\d+)\s*$/;

/** Words that carry no identity: "ACD Group" and "ACD" are the same people. */
const GENERIC_TAIL = /\s+(group|groups|family|families|fam)$/;

function stripCounts(value: string): { text: string; stated: number | null } {
  let text = value;
  let stated: number | null = null;

  const remember = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      stated = stated === null ? parsed : Math.max(stated, parsed);
    }
  };

  for (const pattern of COUNT_CLAUSES) {
    text = text.replace(pattern, (_match, digits?: string) => {
      if (digits !== undefined) remember(digits);
      return " ";
    });
  }

  const trailing = TRAILING_NUMBER.exec(text.trim());
  if (trailing !== null) {
    // A bare trailing 1 is part of the name — "Transformed by Grace 1" is the
    // first of several, not a group of one. Only 2 and up read as a headcount.
    if (Number.parseInt(trailing[1], 10) >= 2) remember(trailing[1]);
    text = text.trim().replace(TRAILING_NUMBER, "");
  }

  return { text: text.replace(/\s+/g, " ").trim(), stated };
}

/**
 * The key two spellings have to agree on. Punctuation and spacing go entirely —
 * "UR GG-5" and "URGG-5" are one group, and only an unspaced key sees that.
 */
export function normalizeGroupKey(label: string): string {
  const base = stripCounts(label.toLowerCase())
    .text.replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (base.length === 0) return "";

  // Peeled repeatedly: "Salumbides Family" and "Salumbides" must land together.
  let trimmed = base;
  for (;;) {
    const next = trimmed.replace(GENERIC_TAIL, "").trim();
    // A group actually called "Family" keeps its name rather than losing it.
    if (next === trimmed || next.length === 0) break;
    trimmed = next;
  }

  return trimmed.replace(/\s+/g, "");
}

/** The typed name with the bookkeeping taken off, casing left alone. */
export function displayName(label: string): string {
  const cleaned = stripCounts(label)
    // "Family Builders Core - (5)" leaves a dangling dash once the count goes.
    .text.replace(/[\s,;.·-]+$/g, "")
    .replace(/^[\s,;.-]+/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : label.trim();
}

/** What the label claims the group size is, if it says so at all. */
export function statedSize(label: string): number | null {
  return stripCounts(label).stated;
}

/**
 * The key rendered as a name, for a group nobody spelled out: "gia" -> "GIA",
 * "awana" -> "Awana". Short keys read as initialisms, longer ones as words.
 */
function keyAsLabel(key: string): string {
  if (key.length === 0) return "";
  if (key.length <= 4) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * One name for a group written several ways. The tidiest spelling wins: the
 * one used most, and the shortest where that ties, so "Torrefranca" beats
 * "Torrefranca. Group - 5 participants".
 *
 * Only spellings that actually mean this group are considered. An organizer
 * can pin registrations together that were never given a common name — GIA's
 * twenty-eight people came in as "Azur Family", "Gonzales Family", "IFL" and
 * several blanks — and picking the tidiest of those would name the whole group
 * after whichever family typed the shortest thing. Where nothing matches, the
 * key itself is the honest answer.
 */
export function pickGroupLabel(labels: string[], key = ""): string {
  const counted = new Map<string, number>();
  for (const label of labels) {
    const clean = displayName(label);
    if (clean.length === 0) continue;
    if (key.length > 0 && normalizeGroupKey(clean) !== key) continue;
    counted.set(clean, (counted.get(clean) ?? 0) + 1);
  }
  return (
    [...counted.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].length - b[0].length,
    )[0]?.[0] ?? keyAsLabel(key)
  );
}

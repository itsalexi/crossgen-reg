/**
 * Constants and pure logic shared by the Convex backend and the Next.js frontend.
 * The frontend imports this for display; the backend imports it as the source of
 * truth. Neither trusts the other's arithmetic — see convex/registrations.ts.
 */

export const EVENT = {
  name: "CrossGen Family Summit 2026",
  tagline: "Pamilyang Sama-Sama, Henerasyong Nagkaka-isa",
  verse: '"Sa alinmang lahi, ang iyong ginawa ay papupurihan, ihahayag nila ang mga gawa Mong makapangyarihan." — Awit 145:4',
  date: "September 26, 2026",
  dayOfWeek: "Saturday",
  venue: "GCF South Metro",
  address: "Daang Hari Road, Almanza Dos, Las Piñas",
  minAge: 14,
} as const;

export const PAYMENT_ACCOUNT = {
  bank: "BDO",
  accountName: "PCEC",
  accountNumber: "003980000243",
  branch: "Anonas-Kamias",
} as const;

// ---------------------------------------------------------------- pricing

export const REGULAR_RATE = 450;
export const GROUP_RATE = 350;
export const GROUP_THRESHOLD = 5;

export type RegistrationType = "regular" | "speaker" | "volunteer" | "sponsor";

export const REGISTRATION_TYPES: {
  value: RegistrationType;
  label: string;
  short: string;
  blurb: string;
  exempt: boolean;
}[] = [
  {
    value: "regular",
    label: "Joining as a guest",
    short: "Guest",
    blurb: "Coming for the day. Registration fee applies.",
    exempt: false,
  },
  {
    value: "speaker",
    label: "Speaking or facilitating",
    short: "Speaker",
    blurb: "Invited to lead a session. Nothing to pay.",
    exempt: true,
  },
  {
    value: "volunteer",
    label: "Serving on a team",
    short: "Volunteer",
    blurb: "Volunteering on the day. Nothing to pay.",
    exempt: true,
  },
  {
    value: "sponsor",
    label: "Supporting as a sponsor",
    short: "Sponsor",
    blurb: "Partnering with the summit. Nothing to pay.",
    exempt: true,
  },
];

export function typeLabel(type: RegistrationType): string {
  return REGISTRATION_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function typeShort(type: RegistrationType): string {
  return REGISTRATION_TYPES.find((t) => t.value === type)?.short ?? type;
}

export function isExempt(type: RegistrationType): boolean {
  return type !== "regular";
}

export function ratePerPerson(participantCount: number): number {
  return participantCount >= GROUP_THRESHOLD ? GROUP_RATE : REGULAR_RATE;
}

/**
 * The only place a peso total is ever computed. One type per registration, so
 * either everyone pays or nobody does.
 */
export function calculateTotal(
  type: RegistrationType,
  participantCount: number,
): number {
  if (isExempt(type)) return 0;
  return participantCount * ratePerPerson(participantCount);
}

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
];

/** "Five of you at the ₱350 group rate" reads better than "5 of you". */
export function spellCount(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}

export function titleCaseCount(count: number): string {
  const word = spellCount(count);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * "2026-09-05" -> "September 5, 2026". Parsed by hand rather than through
 * Date, which would shift the day across time zones.
 */
export function formatDatePaid(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) return value;
  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1];
  if (name === undefined) return value;
  return `${name} ${Number(day)}, ${year}`;
}

const ORDINALS = [
  "", "first", "second", "third", "fourth", "fifth",
  "sixth", "seventh", "eighth", "ninth", "tenth",
];

export function ordinal(position: number): string {
  return ORDINALS[position] ?? `${position}th`;
}

// ------------------------------------------------------- breakout sessions

export const BREAKOUT_SESSIONS = [
  {
    value: 1,
    title: "Making Family Discipleship Work at Home and In Our Church",
  },
  { value: 2, title: "Family Flourishing: Well-Being & Mental Health" },
  { value: 3, title: "Solo Parenting and Discipleship" },
  { value: 4, title: "Faith and Family Connection in the Digital Age" },
  {
    value: 5,
    title: "Fearfully & Wonderfully Made: Navigating Sex, Gender, and Identity",
  },
] as const;

export function breakoutTitle(value: number): string {
  return (
    BREAKOUT_SESSIONS.find((s) => s.value === value)?.title ??
    `Breakout ${value}`
  );
}

// -------------------------------------------------------- where they heard

export type HeardFrom = "social-media" | "church-announcement" | "other";

export const HEARD_FROM_OPTIONS: { value: HeardFrom; label: string }[] = [
  { value: "social-media", label: "Social media" },
  { value: "church-announcement", label: "Church announcement" },
  { value: "other", label: "Somewhere else" },
];

export function heardFromLabel(value: HeardFrom, other?: string): string {
  if (value === "other") {
    const trimmed = (other ?? "").trim();
    return trimmed.length > 0 ? trimmed : "Somewhere else";
  }
  return HEARD_FROM_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** The three agreements, in the organizers' words. All are required. */
export const CONSENTS = [
  {
    key: "consentAccurate",
    label: "I confirm that the information provided is accurate.",
  },
  {
    key: "consentDataUse",
    label:
      "I consent to the collection and use of my personal information for event registration and administration.",
  },
  {
    key: "consentPhotos",
    label:
      "I consent to photos/videos being taken during the event for documentation and promotional purposes.",
  },
] as const;

export type ConsentKey = (typeof CONSENTS)[number]["key"];

// ------------------------------------------------------------ form options

export const GENDERS = ["Male", "Female"] as const;

export const MARITAL_STATUSES = [
  "Single",
  "Married",
  "Widowed",
  "Separated",
] as const;

// -------------------------------------------------------- upload contraints

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
] as const;

export const ALLOWED_UPLOAD_EXTENSIONS = ".jpg,.jpeg,.png,.pdf";

// ------------------------------------------------------------------ limits

/** Not a business rule — a guard against a runaway loop in the participant step. */
export const MAX_PARTICIPANTS = 50;

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
  blurb: string;
  exempt: boolean;
}[] = [
  {
    value: "regular",
    label: "Regular Participant",
    blurb: "Attending the summit. Registration fee applies.",
    exempt: false,
  },
  {
    value: "speaker",
    label: "Speaker",
    blurb: "Invited to speak or facilitate. No fee.",
    exempt: true,
  },
  {
    value: "volunteer",
    label: "Volunteer",
    blurb: "Serving on an event team. No fee.",
    exempt: true,
  },
  {
    value: "sponsor",
    label: "Sponsor",
    blurb: "Supporting the summit as a partner. No fee.",
    exempt: true,
  },
];

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

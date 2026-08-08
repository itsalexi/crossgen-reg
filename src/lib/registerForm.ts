import { EVENT, MAX_UPLOAD_BYTES, ALLOWED_UPLOAD_TYPES } from "@convex/shared";

/**
 * Form-shaped participant: every field is a string because that is what inputs
 * produce. Converted to the typed payload at submit time.
 */
export type ParticipantDraft = {
  fullName: string;
  preferredName: string;
  age: string;
  gender: string;
  maritalStatus: string;
  churchOrganization: string;
  ministryInvolvement: string;
  occupation: string;
  mobileNumber: string;
  email: string;
  cityMunicipality: string;
  breakoutSession: string;
};

export type ParticipantErrors = Partial<Record<keyof ParticipantDraft, string>>;

export function emptyParticipant(): ParticipantDraft {
  return {
    fullName: "",
    preferredName: "",
    age: "",
    gender: "",
    maritalStatus: "",
    churchOrganization: "",
    ministryInvolvement: "",
    occupation: "",
    mobileNumber: "",
    email: "",
    cityMunicipality: "",
    breakoutSession: "",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Mirrors the server rules in convex/registrations.ts. The server is still the
 * authority — this exists so people fix mistakes before they submit, not after.
 */
export function validateParticipant(
  participant: ParticipantDraft,
): ParticipantErrors {
  const errors: ParticipantErrors = {};

  const required: [keyof ParticipantDraft, string][] = [
    ["fullName", "Full name is required."],
    ["gender", "Select a gender."],
    ["maritalStatus", "Select a marital status."],
    ["churchOrganization", "Church or organization is required."],
    ["ministryInvolvement", "Ministry involvement is required."],
    ["occupation", "Occupation is required."],
    ["cityMunicipality", "City or municipality is required."],
    ["breakoutSession", "Choose one breakout session."],
  ];

  for (const [field, message] of required) {
    if (participant[field].trim().length === 0) errors[field] = message;
  }

  const age = Number(participant.age);
  if (participant.age.trim().length === 0) {
    errors.age = "Age is required.";
  } else if (!Number.isInteger(age)) {
    errors.age = "Enter age as a whole number.";
  } else if (age < EVENT.minAge) {
    errors.age = `CrossGen Family Summit is for participants aged ${EVENT.minAge} and above.`;
  } else if (age > 120) {
    errors.age = "Enter a valid age.";
  }

  const mobileDigits = participant.mobileNumber.replace(/\D/g, "");
  if (participant.mobileNumber.trim().length === 0) {
    errors.mobileNumber = "Mobile number is required.";
  } else if (mobileDigits.length < 7) {
    errors.mobileNumber = "Enter a valid mobile number.";
  }

  if (participant.email.trim().length === 0) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_RE.test(participant.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

export function participantIsComplete(participant: ParticipantDraft): boolean {
  return Object.keys(validateParticipant(participant)).length === 0;
}

/** First name only, so copy can address someone by name. Empty if unknown. */
export function firstName(participant: ParticipantDraft): string {
  const preferred = participant.preferredName.trim();
  if (preferred.length > 0) return preferred.split(/\s+/)[0];
  return participant.fullName.trim().split(/\s+/)[0] ?? "";
}

// ------------------------------------------------------------------ payment

export type PaymentDraft = {
  paymentReference: string;
  datePaid: string;
  storageId: string | null;
  fileName: string;
  fileSize: number;
};

export type PaymentErrors = Partial<Record<keyof PaymentDraft, string>>;

export function emptyPayment(): PaymentDraft {
  return {
    paymentReference: "",
    datePaid: "",
    storageId: null,
    fileName: "",
    fileSize: 0,
  };
}

export function validatePayment(payment: PaymentDraft): PaymentErrors {
  const errors: PaymentErrors = {};

  if (payment.paymentReference.trim().length === 0) {
    errors.paymentReference = "Payment reference number is required.";
  }
  if (payment.datePaid.trim().length === 0) {
    errors.datePaid = "Date paid is required.";
  }
  if (payment.storageId === null) {
    errors.storageId = "Upload your proof of payment.";
  }

  return errors;
}

/** Client-side gate on the file picker; re-checked server-side on submit. */
export function validateFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return "File must be 10 MB or smaller.";
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    return "File must be a JPG, PNG, or PDF.";
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import type { Doc } from "@convex/_generated/dataModel";
import {
  breakoutTitle,
  formatDatePaid,
  heardFromLabel,
  typeShort,
  type RegistrationType,
} from "@convex/shared";

const HEADERS = [
  "Registration Number",
  "Group Name",
  "Full Name",
  "Preferred Name",
  "Age",
  "Gender",
  "Marital Status",
  "Church / Organization",
  "Ministry Involvement",
  "Occupation",
  "Mobile Number",
  "Email",
  "City / Municipality",
  "Breakout Session",
  "Registration Type",
  "Payment Type",
  "Payment Reference",
  "Date Paid",
  "Amount",
  "Date Registered",
  "Heard About Us",
  "Photo/Video Consent",
  "Source",
] as const;

function escapeCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  // A leading =, +, -, or @ makes spreadsheet software treat the cell as a
  // formula. Prefix with an apostrophe so exported data stays data.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** One row per participant, per §22 of the spec. */
export function buildParticipantCsv(
  rows: { registration: Doc<"registrations">; participants: Doc<"participants">[] }[],
): string {
  const lines = [HEADERS.map(escapeCell).join(",")];

  for (const { registration, participants } of rows) {
    for (const participant of participants) {
      lines.push(
        [
          registration.registrationNumber,
          registration.groupName ?? "",
          participant.fullName,
          participant.preferredName ?? "",
          participant.age,
          participant.gender,
          participant.maritalStatus,
          participant.churchOrganization,
          participant.ministryInvolvement,
          participant.occupation,
          participant.mobileNumber,
          participant.email,
          participant.cityMunicipality,
          `${participant.breakoutSession}. ${breakoutTitle(participant.breakoutSession)}`,
          typeShort(registration.registrationType as RegistrationType),
          registration.paymentType,
          registration.paymentReference ?? "",
          formatDatePaid(registration.datePaid ?? ""),
          registration.amountUnknown === true ? "" : registration.totalAmount,
          formatDate(registration.submittedAt ?? registration._creationTime),
          heardFromLabel(registration.heardFrom, registration.heardFromOther),
          registration.consentPhotos === undefined
            ? ""
            : registration.consentPhotos
              ? "Yes"
              : "No",
          registration.source === "google-form" ? "Google Form" : "Website",
        ]
          .map(escapeCell)
          .join(","),
      );
    }
  }

  return lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 names correctly.
  const blob = new Blob(["﻿", csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

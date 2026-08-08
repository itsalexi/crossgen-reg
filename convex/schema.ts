import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const registrationTypeValidator = v.union(
  v.literal("regular"),
  v.literal("speaker"),
  v.literal("volunteer"),
  v.literal("sponsor"),
);

export const exemptionReasonValidator = v.union(
  v.literal("speaker"),
  v.literal("volunteer"),
  v.literal("sponsor"),
);

export const breakoutSessionValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
  v.literal(5),
);

export const heardFromValidator = v.union(
  v.literal("social-media"),
  v.literal("church-announcement"),
  v.literal("other"),
);

export const emailStatusValidator = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("failed"),
);

/**
 * Participant fields as submitted from the form. Stored almost verbatim —
 * the only added field is `registrationId`.
 */
export const participantInputValidator = v.object({
  fullName: v.string(),
  preferredName: v.optional(v.string()),
  age: v.number(),
  gender: v.string(),
  maritalStatus: v.string(),
  churchOrganization: v.string(),
  ministryInvolvement: v.string(),
  occupation: v.string(),
  mobileNumber: v.string(),
  email: v.string(),
  cityMunicipality: v.string(),
  breakoutSession: breakoutSessionValidator,
});

export default defineSchema({
  // Convex Auth owns `users`, `authAccounts`, `authSessions`, etc. The Google
  // account id lives in `authAccounts.providerAccountId`; `users` carries
  // name / email / image.
  ...authTables,

  registrations: defineTable({
    registrationNumber: v.string(),
    // Client-generated at form open. Makes submit idempotent under double-click
    // and retry — a repeat call returns the original registration.
    idempotencyKey: v.string(),
    groupName: v.optional(v.string()),

    // Absent on imported rows: nobody signed in to file them. The registrant
    // is identified by the name and email the old form captured.
    registrantUserId: v.optional(v.id("users")),
    // Denormalized so the confirmation email and CSV don't depend on the user
    // record staying put.
    registrantName: v.string(),
    registrantEmail: v.string(),

    registrationType: registrationTypeValidator,
    participantCount: v.number(),
    totalAmount: v.number(),
    // Google Form rows record a payment but not what was charged: a group
    // member paid the group rate, and treating their row as a one-person
    // registration would price it wrong. Better no number than a wrong one.
    amountUnknown: v.optional(v.boolean()),

    // Absent means "web" — every registration predates the import.
    source: v.optional(v.union(v.literal("web"), v.literal("google-form"))),
    // The Google Form's own timestamp, so imported rows sort by when the
    // person actually registered rather than when we imported them.
    submittedAt: v.optional(v.number()),

    paymentType: v.union(v.literal("paid"), v.literal("exempt")),
    exemptionReason: v.optional(exemptionReasonValidator),
    paymentReference: v.optional(v.string()),
    datePaid: v.optional(v.string()),
    paymentProofStorageId: v.optional(v.id("_storage")),
    paymentProofFileName: v.optional(v.string()),
    // Imported receipts live in the organizers' Google Drive. The files are
    // not publicly readable, so we keep the link rather than a copy.
    paymentProofExternalUrl: v.optional(v.string()),

    // Agreed to by the registrant on behalf of everyone on the registration.
    // Optional only so registrations filed before these questions existed
    // still validate — the submit mutation requires them from every new one.
    consentAccurate: v.optional(v.boolean()),
    consentDataUse: v.optional(v.boolean()),
    consentPhotos: v.optional(v.boolean()),

    heardFrom: v.optional(heardFromValidator),
    heardFromOther: v.optional(v.string()),
    // The old form allowed several answers and free text. Kept verbatim.
    heardFromRaw: v.optional(v.string()),

    confirmationEmailStatus: emailStatusValidator,
    confirmationEmailError: v.optional(v.string()),
    confirmationEmailSentAt: v.optional(v.number()),
  })
    .index("by_registrationNumber", ["registrationNumber"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_registrantUserId", ["registrantUserId"]),

  participants: defineTable({
    registrationId: v.id("registrations"),
    fullName: v.string(),
    preferredName: v.optional(v.string()),
    age: v.number(),
    gender: v.string(),
    maritalStatus: v.string(),
    churchOrganization: v.string(),
    ministryInvolvement: v.string(),
    occupation: v.string(),
    mobileNumber: v.string(),
    email: v.string(),
    cityMunicipality: v.string(),
    breakoutSession: breakoutSessionValidator,
  }).index("by_registrationId", ["registrationId"]),

  // Organizers added from inside the app. The ORGANIZER_EMAILS env var still
  // works and acts as the owner list — those accounts can always get in, and
  // cannot be removed through the UI.
  organizers: defineTable({
    email: v.string(),
    addedByEmail: v.string(),
    note: v.optional(v.string()),
  }).index("by_email", ["email"]),

  // Convex has no autoincrement. Sequential registration numbers come from an
  // atomic read-modify-write inside the submit mutation.
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),
});

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
    // Set when someone registering on their own says they are part of a group
    // of five or more that is registering separately, and so pays the group
    // rate. A claim, not a fact: the Groups tab is where it gets checked.
    joiningGroup: v.optional(v.boolean()),
    // An organizer's decision about which group this belongs to, which beats
    // whatever was typed. The group field was free text and the same group was
    // written five ways, so the name can only ever be a guess. Empty string
    // means "put this one on its own"; absent means "go by the name".
    groupKey: v.optional(v.string()),

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
    source: v.optional(
      v.union(
        v.literal("web"),
        v.literal("google-form"),
        // Typed in by an organizer for people who could not use the form,
        // usually a church sending a list of names and nothing else.
        v.literal("organizer"),
      ),
    ),
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

  /**
   * Everything except the name and the workshop is optional here, while the
   * public form still demands all of it. That gap is deliberate: a church can
   * send twenty names and nothing else, and storing a real name with blanks
   * beside it is more honest than storing an invented age and a fake email
   * that will silently bounce.
   */
  participants: defineTable({
    registrationId: v.id("registrations"),
    fullName: v.string(),
    preferredName: v.optional(v.string()),
    age: v.optional(v.number()),
    gender: v.optional(v.string()),
    maritalStatus: v.optional(v.string()),
    churchOrganization: v.optional(v.string()),
    ministryInvolvement: v.optional(v.string()),
    occupation: v.optional(v.string()),
    mobileNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    cityMunicipality: v.optional(v.string()),
    breakoutSession: breakoutSessionValidator,
    /**
     * A seat a sponsor paid for before knowing who would sit in it.
     *
     * Stored as an ordinary participant with an empty name rather than as its
     * own kind of thing, so a seat is already on the roster, already has a
     * code, already counts, and is claimed at the door by typing a name into
     * it. An empty `fullName` on one of these means nobody has claimed it yet.
     */
    seat: v.optional(v.boolean()),
  }).index("by_registrationId", ["registrationId"]),

  /**
   * Who actually walked in on the day.
   *
   * Separate from the registration so arriving is a fact recorded once, by
   * whoever was on the door, without touching what the person registered for.
   * Keyed by participant because families split up: four people on one
   * registration can arrive across two hours and three doors.
   *
   * `at` is when they were marked in, which on a bad wifi day is not when the
   * write reached us — the phone queues offline and sends later, so the time
   * comes from the device that saw them.
   */
  checkIns: defineTable({
    participantId: v.id("participants"),
    at: v.number(),
    byEmail: v.string(),
    // Set when the row arrived from a queue that had been offline, so the
    // door team can tell a late sync from a late arrival.
    queued: v.optional(v.boolean()),
  }).index("by_participantId", ["participantId"]),

  /**
   * People who can sign in, and how far they get.
   *
   * "organizer" sees everything: money, groups, personal details, deletion.
   * "volunteer" sees only the door — the roster, and the ability to mark
   * someone as arrived. Door volunteers are church members recruited for one
   * morning, often on their own phones, and there is no reason that should
   * come with access to what everybody paid.
   *
   * Absent means organizer, because every row predates the distinction. The
   * ORGANIZER_EMAILS env var is the owner list: those accounts can always get
   * in and cannot be removed through the UI.
   */
  organizers: defineTable({
    email: v.string(),
    role: v.optional(v.union(v.literal("organizer"), v.literal("volunteer"))),
    addedByEmail: v.string(),
    note: v.optional(v.string()),
  }).index("by_email", ["email"]),

  /**
   * What the team actually found in the bank, keyed by payment reference.
   * A reference is the unit of reconciliation, not a registration: one deposit
   * often covers several people, especially among the imported Google Form
   * rows where 31 references cover 65 participants.
   */
  payments: defineTable({
    reference: v.string(),
    // "received" carries a real amount. The other two are the organizer
    // saying something about a deposit that has not arrived or does not add
    // up — the amount is meaningless for those and stays 0.
    status: v.optional(
      v.union(v.literal("received"), v.literal("unpaid"), v.literal("problem")),
    ),
    amountReceived: v.number(),
    note: v.optional(v.string()),
    verifiedByEmail: v.string(),
    verifiedAt: v.number(),
  }).index("by_reference", ["reference"]),

  /**
   * Google Form responses that must never come back.
   *
   * The importer skips anything it has already seen by idempotency key — but
   * deleting a registration also deletes that key, so the next sync treated
   * the row as new and re-created it. A deletion is a decision; this is where
   * it is remembered.
   */
  suppressedImports: defineTable({
    idempotencyKey: v.string(),
    registrationNumber: v.string(),
    reason: v.string(),
    byEmail: v.string(),
  }).index("by_key", ["idempotencyKey"]),

  /**
   * An organizer saying a flagged group is fine after all.
   *
   * Some of what the group view flags is not wrong data but a wrong claim:
   * "DJ-GCFSM- 18" was typed by someone who guessed high, and there were only
   * ever five. Nothing in the data can settle that — only a person who asked
   * can, and this is where their answer lives so it stops being raised.
   */
  groupDecisions: defineTable({
    groupKey: v.string(),
    kind: v.union(
      v.literal("short"),
      v.literal("over"),
      v.literal("missing"),
      v.literal("unchecked"),
    ),
    note: v.optional(v.string()),
    byEmail: v.string(),
  }).index("by_groupKey", ["groupKey"]),

  // Remembers the last push to the organizers' Google Sheet.
  syncState: defineTable({
    key: v.string(),
    lastSyncedAt: v.number(),
    lastStatus: v.union(v.literal("ok"), v.literal("failed")),
    lastError: v.optional(v.string()),
    rows: v.number(),
    byEmail: v.string(),
    // New Google Form responses pulled in during the same press.
    imported: v.optional(v.number()),
    importError: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // Convex has no autoincrement. Sequential registration numbers come from an
  // atomic read-modify-write inside the submit mutation.
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),
});

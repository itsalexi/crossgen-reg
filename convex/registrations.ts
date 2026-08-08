import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import {
  participantInputValidator,
  registrationTypeValidator,
} from "./schema";
import {
  ALLOWED_UPLOAD_TYPES,
  calculateTotal,
  EVENT,
  isExempt,
  MAX_PARTICIPANTS,
  MAX_UPLOAD_BYTES,
  type RegistrationType,
} from "./shared";

type ParticipantInput = Infer<typeof participantInputValidator>;

const REGISTRATION_NUMBER_COUNTER = "registrationNumber";
const REGISTRATION_NUMBER_PREFIX = "CG26";

function fail(message: string): never {
  throw new ConvexError(message);
}

function requireText(value: string | undefined, label: string): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.length === 0) fail(`${label} is required.`);
  if (trimmed.length > 200) fail(`${label} is too long.`);
  return trimmed;
}

function requireEmail(value: string, label: string): string {
  const trimmed = requireText(value, label).toLowerCase();
  // Deliberately loose. Bouncing a typo is the organizers' problem to chase,
  // not a reason to reject an otherwise complete registration.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) fail(`${label} is not valid.`);
  return trimmed;
}

function requireMobile(value: string): string {
  const trimmed = requireText(value, "Mobile number");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) fail("Mobile number is not valid.");
  return trimmed;
}

function cleanParticipant(input: ParticipantInput, index: number) {
  const who = `Participant ${index + 1}`;

  if (!Number.isInteger(input.age)) fail(`${who}: age must be a whole number.`);
  if (input.age < EVENT.minAge) {
    fail(
      `${who}: CrossGen Family Summit is for participants aged ${EVENT.minAge} and above.`,
    );
  }
  if (input.age > 120) fail(`${who}: age is not valid.`);

  const preferredName = (input.preferredName ?? "").trim();

  return {
    fullName: requireText(input.fullName, `${who}: full name`),
    preferredName: preferredName.length > 0 ? preferredName : undefined,
    age: input.age,
    gender: requireText(input.gender, `${who}: gender`),
    maritalStatus: requireText(input.maritalStatus, `${who}: marital status`),
    churchOrganization: requireText(
      input.churchOrganization,
      `${who}: church / organization`,
    ),
    ministryInvolvement: requireText(
      input.ministryInvolvement,
      `${who}: ministry involvement`,
    ),
    occupation: requireText(input.occupation, `${who}: occupation`),
    mobileNumber: requireMobile(input.mobileNumber),
    email: requireEmail(input.email, `${who}: email`),
    cityMunicipality: requireText(
      input.cityMunicipality,
      `${who}: city / municipality`,
    ),
    breakoutSession: input.breakoutSession,
  };
}

/**
 * Sequential, human-readable registration numbers. Convex mutations are
 * serializable transactions, so a concurrent submit either sees this write or
 * retries — no two registrations can claim the same number.
 */
async function allocateRegistrationNumber(ctx: MutationCtx): Promise<string> {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", REGISTRATION_NUMBER_COUNTER))
    .unique();

  let next: number;
  if (counter === null) {
    next = 1;
    await ctx.db.insert("counters", {
      name: REGISTRATION_NUMBER_COUNTER,
      value: next,
    });
  } else {
    next = counter.value + 1;
    await ctx.db.patch(counter._id, { value: next });
  }

  return `${REGISTRATION_NUMBER_PREFIX}-${String(next).padStart(5, "0")}`;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) fail("Sign in before uploading proof of payment.");
    return await ctx.storage.generateUploadUrl();
  },
});

export const submitArgs = {
  idempotencyKey: v.string(),
  groupName: v.optional(v.string()),
  registrationType: registrationTypeValidator,
  participants: v.array(participantInputValidator),
  payment: v.optional(
    v.object({
      paymentReference: v.string(),
      datePaid: v.string(),
      storageId: v.id("_storage"),
      fileName: v.optional(v.string()),
    }),
  ),
};

export type SubmitPayload = Infer<ReturnType<typeof v.object<typeof submitArgs>>>;

/**
 * Everything a submission does, minus the auth check. Split out so the caller
 * supplies the identity — `submit` takes it from the session.
 */
export async function createRegistration(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: SubmitPayload,
) {
  const user = await ctx.db.get(userId);
  if (user === null) fail("Your account could not be found. Sign in again.");

  // Idempotency first: a retried submit must not create a second registration
  // or burn a second registration number.
  const existing = await ctx.db
    .query("registrations")
    .withIndex("by_idempotencyKey", (q) =>
      q.eq("idempotencyKey", args.idempotencyKey),
    )
    .unique();
  if (existing !== null) {
    return {
      registrationId: existing._id,
      registrationNumber: existing.registrationNumber,
      totalAmount: existing.totalAmount,
      alreadySubmitted: true,
    };
  }

  if (args.participants.length === 0) fail("Add at least one participant.");
  if (args.participants.length > MAX_PARTICIPANTS) {
    fail(`A single registration is limited to ${MAX_PARTICIPANTS} participants.`);
  }

  const participants = args.participants.map(cleanParticipant);
  const participantCount = participants.length;

  const groupName = (args.groupName ?? "").trim();
  if (participantCount > 1 && groupName.length === 0) {
    fail("Group name is required when registering more than one participant.");
  }

  const type = args.registrationType as RegistrationType;
  const exempt = isExempt(type);

  // Amount is recomputed here and nowhere else. Whatever the client displayed
  // is irrelevant — it never reaches this mutation.
  const totalAmount = calculateTotal(type, participantCount);

  let paymentFields: {
    paymentReference?: string;
    datePaid?: string;
    paymentProofStorageId?: Id<"_storage">;
    paymentProofFileName?: string;
  } = {};

  if (exempt) {
    // Reject rather than silently drop: payment data on an exempt
    // registration means the client and server disagree about what this is.
    if (args.payment !== undefined) {
      fail("Payment details cannot be attached to an exempt registration.");
    }
  } else {
    if (args.payment === undefined) {
      fail("Payment details are required for a regular registration.");
    }

    const metadata = await ctx.db.system.get(args.payment.storageId);
    if (metadata === null) {
      fail("The uploaded proof of payment could not be found. Upload it again.");
    }
    if (metadata.size > MAX_UPLOAD_BYTES) {
      fail("Proof of payment must be 10 MB or smaller.");
    }
    if (
      metadata.contentType === undefined ||
      !ALLOWED_UPLOAD_TYPES.includes(
        metadata.contentType as (typeof ALLOWED_UPLOAD_TYPES)[number],
      )
    ) {
      fail("Proof of payment must be a JPG, PNG, or PDF file.");
    }

    const fileName = (args.payment.fileName ?? "").trim();
    paymentFields = {
      paymentReference: requireText(
        args.payment.paymentReference,
        "Payment reference number",
      ),
      datePaid: requireText(args.payment.datePaid, "Date paid"),
      paymentProofStorageId: args.payment.storageId,
      paymentProofFileName: fileName.length > 0 ? fileName : undefined,
    };
  }

  const registrationNumber = await allocateRegistrationNumber(ctx);

  const registrationId = await ctx.db.insert("registrations", {
    registrationNumber,
    idempotencyKey: args.idempotencyKey,
    groupName: groupName.length > 0 ? groupName : undefined,
    registrantUserId: userId,
    registrantName: (user.name ?? participants[0].fullName).trim(),
    registrantEmail: (user.email ?? participants[0].email).toLowerCase(),
    registrationType: type,
    participantCount,
    totalAmount,
    paymentType: exempt ? "exempt" : "paid",
    exemptionReason: exempt ? (type as "speaker" | "volunteer" | "sponsor") : undefined,
    confirmationEmailStatus: "pending",
    ...paymentFields,
  });

  for (const participant of participants) {
    await ctx.db.insert("participants", { registrationId, ...participant });
  }

  // Scheduled, not awaited. The registration is already committed, so a
  // Resend outage cannot roll it back.
  await ctx.scheduler.runAfter(0, internal.emails.sendConfirmation, {
    registrationId,
  });

  return {
    registrationId,
    registrationNumber,
    totalAmount,
    alreadySubmitted: false,
  };
}

export const submit = mutation({
  args: submitArgs,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) fail("Sign in to submit a registration.");
    return await createRegistration(ctx, userId, args);
  },
});

/**
 * Powers the confirmation screen. Looked up by the printed registration
 * number rather than the document id, so nothing internal ends up in a URL
 * people paste around. Still registrant-scoped.
 */
export const getMine = query({
  args: { registrationNumber: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_registrationNumber", (q) =>
        q.eq("registrationNumber", args.registrationNumber.trim().toUpperCase()),
      )
      .unique();
    if (registration === null || registration.registrantUserId !== userId) {
      return null;
    }

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_registrationId", (q) =>
        q.eq("registrationId", registration._id),
      )
      .collect();

    return { registration, participants };
  },
});

/** Previous registrations by the signed-in user, shown on the landing page. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    return await ctx.db
      .query("registrations")
      .withIndex("by_registrantUserId", (q) => q.eq("registrantUserId", userId))
      .order("desc")
      .collect();
  },
});

// --------------------------------------------------- internals for emailing

export const getForEmail = internalQuery({
  args: { registrationId: v.id("registrations") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    registration: Doc<"registrations">;
    participants: Doc<"participants">[];
  } | null> => {
    const registration = await ctx.db.get(args.registrationId);
    if (registration === null) return null;

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_registrationId", (q) =>
        q.eq("registrationId", registration._id),
      )
      .collect();

    return { registration, participants };
  },
});

export const recordEmailResult = internalMutation({
  args: {
    registrationId: v.id("registrations"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.registrationId, {
      confirmationEmailStatus: args.status,
      confirmationEmailError: args.error,
      confirmationEmailSentAt: args.sentAt,
    });
  },
});

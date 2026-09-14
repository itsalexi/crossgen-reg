import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { normalizeGroupKey } from "./groupKey";
import { calculateTotal, isExempt, MAX_PARTICIPANTS, type RegistrationType } from "./shared";
import {
  allocateRegistrationNumber,
  cleanParticipant,
} from "./registrations";
import {
  breakoutSessionValidator,
  participantInputValidator,
  registrationTypeValidator,
} from "./schema";
import {
  action,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

type AnyCtx = QueryCtx | MutationCtx;

/** Accounts named in the env var. They can always get in, and can't be removed. */
function ownerEmails(): string[] {
  return (process.env.ORGANIZER_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.toLowerCase().trim())
    .filter((entry) => entry.length > 0);
}

async function signedInEmail(ctx: AnyCtx): Promise<string | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  const email = user?.email?.toLowerCase().trim();
  return email !== undefined && email.length > 0 ? email : null;
}

export type Access = { email: string; isOwner: boolean };

/**
 * The actual access boundary. Every organizer function calls this — the route
 * guard in the UI is only convenience.
 */
async function requireOrganizer(ctx: AnyCtx): Promise<Access> {
  const email = await signedInEmail(ctx);
  if (email === null) throw new ConvexError("Sign in to view registrations.");

  if (ownerEmails().includes(email)) return { email, isOwner: true };

  const added = await ctx.db
    .query("organizers")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  // A volunteer is on the list but only for the door. Everything in this file
  // is organizer work, so they are turned away here by design.
  if (added !== null && (added.role ?? "organizer") === "organizer") {
    return { email, isOwner: false };
  }
  if (added !== null) {
    throw new ConvexError(
      "This account can only use the check-in screen at /organizer/checkin.",
    );
  }

  throw new ConvexError("This account is not an authorized organizer.");
}

export const amIOrganizer = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireOrganizer(ctx);
      return true;
    } catch {
      return false;
    }
  },
});

export const whoAmI = query({
  args: {},
  handler: async (ctx): Promise<Access | null> => {
    try {
      return await requireOrganizer(ctx);
    } catch {
      return null;
    }
  },
});

/**
 * Everything the dashboard needs, in one subscription. An event this size runs
 * to hundreds of rows, not millions, so filtering and totals happen in the
 * browser — which keeps every filter instant and the server simple.
 */
export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    await requireOrganizer(ctx);

    const registrations = await ctx.db
      .query("registrations")
      .order("desc")
      .collect();
    const participants = await ctx.db.query("participants").collect();
    const payments = await ctx.db.query("payments").collect();
    const groupDecisions = await ctx.db.query("groupDecisions").collect();

    return { registrations, participants, payments, groupDecisions };
  },
});

export const get = query({
  args: { registrationId: v.id("registrations") },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);

    const registration = await ctx.db.get(args.registrationId);
    if (registration === null) return null;

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_registrationId", (q) =>
        q.eq("registrationId", registration._id),
      )
      .collect();

    const paymentProofUrl =
      registration.paymentProofStorageId !== undefined
        ? await ctx.storage.getUrl(registration.paymentProofStorageId)
        : null;

    return { registration, participants, paymentProofUrl };
  },
});

export const paymentProofUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);

    const entries = await Promise.all(
      args.storageIds.map(
        async (storageId): Promise<[Id<"_storage">, string | null]> => [
          storageId,
          await ctx.storage.getUrl(storageId),
        ],
      ),
    );

    return Object.fromEntries(entries) as Record<string, string | null>;
  },
});

/** §27: a registration outlives a Resend outage, so this has to be re-runnable. */
export const resendConfirmation = mutation({
  args: { registrationId: v.id("registrations") },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);

    const registration = await ctx.db.get(args.registrationId);
    if (registration === null) throw new ConvexError("Registration not found.");

    await ctx.db.patch(args.registrationId, {
      confirmationEmailStatus: "pending",
      confirmationEmailError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.emails.sendConfirmation, {
      registrationId: args.registrationId,
    });
  },
});

/** Re-sends every confirmation that failed, in one go. */
export const resendAllFailed = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOrganizer(ctx);

    const failed = (await ctx.db.query("registrations").collect()).filter(
      (r) => r.confirmationEmailStatus === "failed",
    );

    for (const registration of failed) {
      await ctx.db.patch(registration._id, {
        confirmationEmailStatus: "pending",
        confirmationEmailError: undefined,
      });
      await ctx.scheduler.runAfter(0, internal.emails.sendConfirmation, {
        registrationId: registration._id,
      });
    }

    return failed.length;
  },
});

/**
 * Corrects what someone typed. People mistype payment references — and since
 * a reference is what groups a deposit together, fixing one is also how two
 * payment cards become one.
 */
export const updateRegistration = mutation({
  args: {
    registrationId: v.id("registrations"),
    groupName: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    datePaid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);

    const registration = await ctx.db.get(args.registrationId);
    if (registration === null) throw new ConvexError("Registration not found.");

    const trimmed = (value: string | undefined) => {
      if (value === undefined) return undefined;
      const next = value.trim();
      return next.length > 0 ? next : undefined;
    };

    await ctx.db.patch(args.registrationId, {
      groupName: trimmed(args.groupName),
      paymentReference: trimmed(args.paymentReference),
      datePaid: trimmed(args.datePaid),
    });
  },
});

/**
 * Puts a registration in a group by hand.
 *
 * The typed name is a guess — "Torrefranca" on one registration and
 * "Torrefranca group , 5 participants" on another may or may not be the same
 * people, and nothing in the data says which. This is where someone who asked
 * writes the answer down.
 *
 * `groupKey: null` gives up the decision and goes back to the typed name.
 * An empty string is a decision too: this registration stands on its own.
 */
export const assignGroup = mutation({
  args: {
    registrationId: v.id("registrations"),
    groupKey: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);

    const registration = await ctx.db.get(args.registrationId);
    if (registration === null) throw new ConvexError("Registration not found.");

    await ctx.db.patch(args.registrationId, {
      groupKey:
        args.groupKey === null
          ? undefined
          : // Normalised on the way in, so a key typed by hand lands in the
            // same bucket as one derived from a label.
            normalizeGroupKey(args.groupKey),
    });
  },
});

/**
 * The same thing from the command line, for bulk tidying:
 *
 *   npx convex run organizer:assignGroupByNumber \
 *     '{"registrationNumbers":["CG26-00011"],"groupKey":"torrefranca"}' --prod
 */
export const assignGroupByNumber = internalMutation({
  args: {
    registrationNumbers: v.array(v.string()),
    groupKey: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const key =
      args.groupKey === null ? undefined : normalizeGroupKey(args.groupKey);

    const done: string[] = [];
    const missing: string[] = [];
    for (const number of args.registrationNumbers) {
      const registration = await ctx.db
        .query("registrations")
        .withIndex("by_registrationNumber", (q) =>
          q.eq("registrationNumber", number.trim()),
        )
        .unique();
      if (registration === null) {
        missing.push(number);
        continue;
      }
      await ctx.db.patch(registration._id, { groupKey: key });
      done.push(number);
    }

    return { assignedTo: key ?? "(back to the typed name)", done, missing };
  },
});

const groupIssueKind = v.union(
  v.literal("short"),
  v.literal("over"),
  v.literal("missing"),
  v.literal("unchecked"),
);

/**
 * Settles a flagged group by hand — "there were only ever five of them, the
 * 18 was a guess". Kept rather than acted on, so the reasoning survives the
 * person who worked it out.
 */
export const dismissGroupIssue = mutation({
  args: {
    groupKey: v.string(),
    kind: groupIssueKind,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireOrganizer(ctx);

    const groupKey = normalizeGroupKey(args.groupKey);
    if (groupKey.length === 0) throw new ConvexError("Missing group.");

    const existing = (
      await ctx.db
        .query("groupDecisions")
        .withIndex("by_groupKey", (q) => q.eq("groupKey", groupKey))
        .collect()
    ).find((row) => row.kind === args.kind);

    const note = (args.note ?? "").trim();
    const next = {
      groupKey,
      kind: args.kind,
      note: note.length > 0 ? note : undefined,
      byEmail: me.email,
    };

    if (existing === undefined) await ctx.db.insert("groupDecisions", next);
    else await ctx.db.patch(existing._id, next);
  },
});

/** The same from the command line, for settling a batch at once. */
export const settleGroupIssueAs = internalMutation({
  args: {
    groupKey: v.string(),
    kind: groupIssueKind,
    note: v.string(),
    byEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const groupKey = normalizeGroupKey(args.groupKey);
    const existing = (
      await ctx.db
        .query("groupDecisions")
        .withIndex("by_groupKey", (q) => q.eq("groupKey", groupKey))
        .collect()
    ).find((row) => row.kind === args.kind);

    const next = {
      groupKey,
      kind: args.kind,
      note: args.note,
      byEmail: args.byEmail.toLowerCase().trim(),
    };
    if (existing === undefined) await ctx.db.insert("groupDecisions", next);
    else await ctx.db.patch(existing._id, next);
    return next;
  },
});

/** Undo from the command line, for a decision made by mistake. */
export const clearGroupDecision = internalMutation({
  args: { groupKey: v.string(), kind: v.optional(groupIssueKind) },
  handler: async (ctx, args) => {
    const groupKey = normalizeGroupKey(args.groupKey);
    const rows = await ctx.db
      .query("groupDecisions")
      .withIndex("by_groupKey", (q) => q.eq("groupKey", groupKey))
      .collect();

    const removed: string[] = [];
    for (const row of rows) {
      if (args.kind !== undefined && row.kind !== args.kind) continue;
      await ctx.db.delete(row._id);
      removed.push(row.kind);
    }
    return { groupKey, removed };
  },
});

/** Puts a settled flag back on the pile. */
export const restoreGroupIssue = mutation({
  args: { groupKey: v.string(), kind: groupIssueKind },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);

    const groupKey = normalizeGroupKey(args.groupKey);
    for (const row of await ctx.db
      .query("groupDecisions")
      .withIndex("by_groupKey", (q) => q.eq("groupKey", groupKey))
      .collect()) {
      if (row.kind === args.kind) await ctx.db.delete(row._id);
    }
  },
});

/**
 * Rewrites a mistyped payment reference from the command line.
 *
 * People copy the reference off a receipt by hand, and a group copying the
 * same receipt gets it wrong in different ways: "0034358", "O034358" with a
 * capital letter O, "00034358". Since the reference is what groups a deposit
 * together, correcting one is also how several payment cards become one.
 */
export const setPaymentReferenceByNumber = internalMutation({
  args: {
    registrationNumbers: v.array(v.string()),
    paymentReference: v.string(),
  },
  handler: async (ctx, args) => {
    const reference = args.paymentReference.trim();
    if (reference.length === 0) throw new ConvexError("Missing reference.");

    const changed: { registrationNumber: string; was: string }[] = [];
    const missing: string[] = [];

    for (const number of args.registrationNumbers) {
      const registration = await ctx.db
        .query("registrations")
        .withIndex("by_registrationNumber", (q) =>
          q.eq("registrationNumber", number.trim()),
        )
        .unique();
      if (registration === null) {
        missing.push(number);
        continue;
      }
      changed.push({
        registrationNumber: number,
        was: registration.paymentReference ?? "(none)",
      });
      await ctx.db.patch(registration._id, { paymentReference: reference });
    }

    return { now: reference, changed, missing };
  },
});

/**
 * Adds people an organizer was given outside the form.
 *
 * Churches send lists. "Church of the Nazarene-GMA, twenty names" arrives as
 * twenty names and nothing else, usually after registration has closed, and
 * those people are still coming on the day. This is the only route in for them.
 *
 * Deliberately not held to the public form's rules:
 *
 * - Only a name is required. Everything else is stored if given and left blank
 *   if not, rather than filled with an invented age or a fake email address.
 * - The closing deadline does not apply. It exists to stop the public adding
 *   themselves, not to stop the team seating someone.
 * - Any workshop can be chosen, including ones closed to new registrants.
 * - No confirmation email goes out, since there is usually no address to send
 *   one to. Use Resend from the registration once contact details arrive.
 */
export const addRegistration = mutation({
  args: {
    groupName: v.optional(v.string()),
    groupKey: v.optional(v.string()),
    registrationType: registrationTypeValidator,
    paymentReference: v.optional(v.string()),
    datePaid: v.optional(v.string()),
    churchOrganization: v.optional(v.string()),
    cityMunicipality: v.optional(v.string()),
    breakoutSession: breakoutSessionValidator,
    people: v.array(
      v.object({
        fullName: v.string(),
        email: v.optional(v.string()),
        mobileNumber: v.optional(v.string()),
        breakoutSession: v.optional(breakoutSessionValidator),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const me = await requireOrganizer(ctx);

    const clean = (value: string | undefined): string | undefined => {
      const trimmed = (value ?? "").trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const people = args.people
      .map((person) => ({
        fullName: person.fullName.trim(),
        email: clean(person.email)?.toLowerCase(),
        mobileNumber: clean(person.mobileNumber),
        breakoutSession: person.breakoutSession ?? args.breakoutSession,
      }))
      .filter((person) => person.fullName.length > 0);

    if (people.length === 0) throw new ConvexError("Add at least one name.");
    if (people.length > MAX_PARTICIPANTS) {
      throw new ConvexError(
        `That is more than ${MAX_PARTICIPANTS} names for one registration. Split it.`,
      );
    }

    const type = args.registrationType as RegistrationType;
    const exempt = isExempt(type);
    const registrationNumber = await allocateRegistrationNumber(ctx, "web");

    const registrationId = await ctx.db.insert("registrations", {
      registrationNumber,
      idempotencyKey: `organizer:${registrationNumber}`,
      groupName: clean(args.groupName),
      groupKey:
        args.groupKey === undefined
          ? undefined
          : normalizeGroupKey(args.groupKey),
      registrantName: me.email,
      registrantEmail: me.email,
      registrationType: type,
      participantCount: people.length,
      // Priced as if they had filled the form themselves. The Groups tab will
      // re-rate them against whatever group they land in.
      totalAmount: calculateTotal(type, people.length),
      source: "organizer",
      paymentType: exempt ? "exempt" : "paid",
      exemptionReason: exempt ? (type as "speaker" | "volunteer" | "sponsor") : undefined,
      paymentReference: clean(args.paymentReference),
      datePaid: clean(args.datePaid),
      // Nobody agreed to anything on a form here, and recording a consent that
      // was never given would be worse than recording none.
      confirmationEmailStatus: "sent",
      confirmationEmailSentAt: Date.now(),
    });

    for (const person of people) {
      await ctx.db.insert("participants", {
        registrationId,
        fullName: person.fullName,
        email: person.email,
        mobileNumber: person.mobileNumber,
        churchOrganization: clean(args.churchOrganization),
        cityMunicipality: clean(args.cityMunicipality),
        breakoutSession: person.breakoutSession,
      });
    }

    return { registrationNumber, added: people.length };
  },
});

/**
 * The same from the command line, for a list that arrives by message.
 */
export const addRegistrationAs = internalMutation({
  args: {
    groupName: v.optional(v.string()),
    groupKey: v.optional(v.string()),
    churchOrganization: v.optional(v.string()),
    cityMunicipality: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    datePaid: v.optional(v.string()),
    breakoutSession: breakoutSessionValidator,
    registrationType: registrationTypeValidator,
    byEmail: v.string(),
    /** A bare list, when that is all a church sent. */
    names: v.optional(v.array(v.string())),
    /** Or the full detail, when somebody sent it person by person. */
    people: v.optional(
      v.array(
        v.object({
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
          breakoutSession: v.optional(breakoutSessionValidator),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const clean = (value: string | undefined): string | undefined => {
      const trimmed = (value ?? "").trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };
    // Either shape is accepted; a bare name is just the sparsest version of
    // the detailed one.
    const people = [
      ...(args.people ?? []),
      ...(args.names ?? []).map((fullName) => ({ fullName })),
    ]
      .map((person) => ({
        ...person,
        fullName: person.fullName.trim(),
      }))
      .filter((person) => person.fullName.length > 0);
    if (people.length === 0) throw new ConvexError("Add at least one name.");
    const names = people.map((person) => person.fullName);

    const type = args.registrationType as RegistrationType;
    const exempt = isExempt(type);
    const registrationNumber = await allocateRegistrationNumber(ctx, "web");

    const registrationId = await ctx.db.insert("registrations", {
      registrationNumber,
      idempotencyKey: `organizer:${registrationNumber}`,
      groupName: clean(args.groupName),
      groupKey:
        args.groupKey === undefined
          ? undefined
          : normalizeGroupKey(args.groupKey),
      registrantName: args.byEmail,
      registrantEmail: args.byEmail,
      registrationType: type,
      participantCount: people.length,
      totalAmount: calculateTotal(type, people.length),
      source: "organizer",
      paymentType: exempt ? "exempt" : "paid",
      exemptionReason: exempt
        ? (type as "speaker" | "volunteer" | "sponsor")
        : undefined,
      paymentReference: clean(args.paymentReference),
      datePaid: clean(args.datePaid),
      confirmationEmailStatus: "sent",
      confirmationEmailSentAt: Date.now(),
    });

    for (const person of people) {
      const detail = person as Record<string, unknown>;
      await ctx.db.insert("participants", {
        registrationId,
        fullName: person.fullName,
        preferredName: clean(detail.preferredName as string | undefined),
        age: typeof detail.age === "number" ? detail.age : undefined,
        gender: clean(detail.gender as string | undefined),
        maritalStatus: clean(detail.maritalStatus as string | undefined),
        // Falls back to the value given for the whole list.
        churchOrganization:
          clean(detail.churchOrganization as string | undefined) ??
          clean(args.churchOrganization),
        ministryInvolvement: clean(
          detail.ministryInvolvement as string | undefined,
        ),
        occupation: clean(detail.occupation as string | undefined),
        mobileNumber: clean(detail.mobileNumber as string | undefined),
        email: clean(detail.email as string | undefined)?.toLowerCase(),
        cityMunicipality:
          clean(detail.cityMunicipality as string | undefined) ??
          clean(args.cityMunicipality),
        breakoutSession:
          (detail.breakoutSession as 1 | 2 | 3 | 4 | 5 | undefined) ??
          args.breakoutSession,
      });
    }

    return { registrationNumber, added: people.length, names };
  },
});

/**
 * Changes what a registration is: guest, speaker, volunteer or sponsor.
 *
 * Sponsored places were being recorded as ₱3,500 received against a made-up
 * reference, which made the books read as though money had moved. Marking them
 * exempt says the true thing — these seats were given, not bought — and the
 * amount owed drops to zero rather than being cancelled out by a phantom
 * deposit.
 */
export const setRegistrationType = internalMutation({
  args: {
    registrationNumbers: v.array(v.string()),
    registrationType: registrationTypeValidator,
    clearPaymentReference: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const type = args.registrationType as RegistrationType;
    const exempt = isExempt(type);

    const done: string[] = [];
    const missing: string[] = [];

    for (const number of args.registrationNumbers) {
      const registration = await ctx.db
        .query("registrations")
        .withIndex("by_registrationNumber", (q) =>
          q.eq("registrationNumber", number.trim()),
        )
        .unique();
      if (registration === null) {
        missing.push(number);
        continue;
      }

      const people = (
        await ctx.db
          .query("participants")
          .withIndex("by_registrationId", (q) =>
            q.eq("registrationId", registration._id),
          )
          .collect()
      ).length;

      await ctx.db.patch(registration._id, {
        registrationType: type,
        paymentType: exempt ? "exempt" : "paid",
        exemptionReason: exempt
          ? (type as "speaker" | "volunteer" | "sponsor")
          : undefined,
        totalAmount: calculateTotal(type, people),
        amountUnknown: exempt ? undefined : registration.amountUnknown,
        ...(args.clearPaymentReference === true
          ? { paymentReference: undefined, datePaid: undefined }
          : {}),
      });

      done.push(
        `${registration.registrationNumber}: ${people} people now ${type}, owes ${calculateTotal(type, people)}`,
      );
    }

    return { done, missing };
  },
});

/**
 * Moves people between workshops from the command line.
 *
 * Organizers can put someone into any of the five, including the ones closed
 * to new registrants — a room being full for the public is not a reason the
 * team cannot seat one more person deliberately.
 *
 * Matches on the full name and refuses anything ambiguous, so a request for
 * "Rey Ornido" can never quietly move Eucelle Ornido instead.
 */
export const setBreakoutSession = internalMutation({
  args: {
    changes: v.array(
      v.object({
        fullName: v.string(),
        breakoutSession: breakoutSessionValidator,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const everyone = await ctx.db.query("participants").collect();
    const done: string[] = [];
    const problems: string[] = [];

    for (const change of args.changes) {
      const wanted = change.fullName.trim().toLowerCase();
      const matches = everyone.filter(
        (p) => p.fullName.trim().toLowerCase() === wanted,
      );

      if (matches.length === 0) {
        problems.push(`${change.fullName}: nobody by that name`);
        continue;
      }
      if (matches.length > 1) {
        problems.push(`${change.fullName}: ${matches.length} people share it`);
        continue;
      }

      const participant = matches[0];
      const was = participant.breakoutSession;
      await ctx.db.patch(participant._id, {
        breakoutSession: change.breakoutSession,
      });
      done.push(
        `${participant.fullName}: session ${was} -> ${change.breakoutSession}`,
      );
    }

    return { done, problems };
  },
});

/** Corrects one participant's details, held to the same rules as the form. */
export const updateParticipant = mutation({
  args: {
    participantId: v.id("participants"),
    participant: participantInputValidator,
  },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);

    const existing = await ctx.db.get(args.participantId);
    if (existing === null) throw new ConvexError("Participant not found.");

    // Same validation the registration form runs, so an organizer edit cannot
    // put something in that a registrant could not have.
    const clean = cleanParticipant(args.participant, 0);
    await ctx.db.patch(args.participantId, clean);
  },
});

/**
 * Deletes a registration and everyone on it.
 *
 * Irreversible, so the UI makes the organizer type the registration number
 * first. The uploaded proof of payment goes too — leaving the blob behind
 * would keep someone's bank receipt in storage after their record is gone.
 *
 * The payment record is deliberately left alone: it is keyed by reference and
 * may cover registrations that are staying.
 */
export const deleteRegistration = mutation({
  args: { registrationId: v.id("registrations") },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);

    const registration = await ctx.db.get(args.registrationId);
    if (registration === null) throw new ConvexError("Registration not found.");

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_registrationId", (q) =>
        q.eq("registrationId", args.registrationId),
      )
      .collect();

    // Remember imported deletions, or the next sync re-creates them.
    if (registration.source === "google-form") {
      await ctx.db.insert("suppressedImports", {
        idempotencyKey: registration.idempotencyKey,
        registrationNumber: registration.registrationNumber,
        reason: "Removed by an organizer from the dashboard.",
        byEmail: (await requireOrganizer(ctx)).email,
      });
    }

    for (const participant of participants) {
      await ctx.db.delete(participant._id);
    }

    if (registration.paymentProofStorageId !== undefined) {
      await ctx.storage.delete(registration.paymentProofStorageId);
    }

    await ctx.db.delete(args.registrationId);

    return {
      registrationNumber: registration.registrationNumber,
      participants: participants.length,
    };
  },
});

/**
 * Deletes a registration from the command line, for tidying duplicates.
 *
 * Unlike the dashboard's version this keeps the uploaded receipt when another
 * registration still cites the same payment reference. A duplicate and the
 * rows it duplicates usually share one deposit, and that image may be the only
 * proof of it we hold — losing it to a tidy-up would cost more than the
 * orphaned file saves.
 */
export const deleteRegistrationByNumber = internalMutation({
  args: { registrationNumbers: v.array(v.string()), reason: v.string() },
  handler: async (ctx, args) => {
    const done: {
      registrationNumber: string;
      people: string[];
      receiptKept: boolean;
    }[] = [];
    const missing: string[] = [];

    for (const number of args.registrationNumbers) {
      const registration = await ctx.db
        .query("registrations")
        .withIndex("by_registrationNumber", (q) =>
          q.eq("registrationNumber", number.trim()),
        )
        .unique();
      if (registration === null) {
        missing.push(number);
        continue;
      }

      const participants = await ctx.db
        .query("participants")
        .withIndex("by_registrationId", (q) =>
          q.eq("registrationId", registration._id),
        )
        .collect();

      if (registration.source === "google-form") {
        await ctx.db.insert("suppressedImports", {
          idempotencyKey: registration.idempotencyKey,
          registrationNumber: registration.registrationNumber,
          reason: args.reason,
          byEmail: "alexicanamo@gmail.com",
        });
      }

      const reference = (registration.paymentReference ?? "").trim();
      const sharesDeposit =
        reference.length > 0 &&
        (await ctx.db.query("registrations").collect()).some(
          (other) =>
            other._id !== registration._id &&
            (other.paymentReference ?? "").trim() === reference,
        );

      if (
        registration.paymentProofStorageId !== undefined &&
        !sharesDeposit
      ) {
        await ctx.storage.delete(registration.paymentProofStorageId);
      }

      for (const participant of participants) {
        await ctx.db.delete(participant._id);
      }
      await ctx.db.delete(registration._id);

      done.push({
        registrationNumber: registration.registrationNumber,
        people: participants.map((p) => p.fullName),
        receiptKept:
          registration.paymentProofStorageId !== undefined && sharesDeposit,
      });
    }

    return { done, missing };
  },
});

/**
 * Takes people off a registration without deleting the whole thing.
 *
 * Needed when two groups each registered the same person: one of them has to
 * give them up, and the rest of that registration is perfectly good. The
 * headcount and the amount owed are both recalculated, because dropping below
 * five people changes the rate for everyone left on it.
 */
export const removeParticipants = internalMutation({
  args: {
    registrationNumber: v.string(),
    fullNames: v.array(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_registrationNumber", (q) =>
        q.eq("registrationNumber", args.registrationNumber.trim()),
      )
      .unique();
    if (registration === null) throw new ConvexError("Registration not found.");

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_registrationId", (q) =>
        q.eq("registrationId", registration._id),
      )
      .collect();

    const wanted = args.fullNames.map((n) => n.trim().toLowerCase());
    const going = participants.filter((p) =>
      wanted.includes(p.fullName.trim().toLowerCase()),
    );
    const notFound = wanted.filter(
      (n) => !participants.some((p) => p.fullName.trim().toLowerCase() === n),
    );
    if (notFound.length > 0) {
      throw new ConvexError(`Not on that registration: ${notFound.join(", ")}`);
    }
    if (going.length === participants.length) {
      throw new ConvexError(
        "That would empty the registration — delete it instead.",
      );
    }

    for (const participant of going) {
      await ctx.db.delete(participant._id);
    }

    const remaining = participants.length - going.length;
    const totalAmount = calculateTotal(
      registration.registrationType,
      remaining,
    );

    await ctx.db.patch(registration._id, {
      participantCount: remaining,
      // Imported rows never had an amount worth trusting; leave them alone.
      ...(registration.amountUnknown === true ? {} : { totalAmount }),
    });

    return {
      registrationNumber: registration.registrationNumber,
      removed: going.map((p) => p.fullName),
      remaining,
      totalAmount:
        registration.amountUnknown === true ? "unchanged" : totalAmount,
      reason: args.reason,
    };
  },
});

/**
 * Drops repeated rows inside one registration.
 *
 * Someone filling in a group sometimes adds a person twice, and the second row
 * is a byte-for-byte copy: same name, age, mobile, email, session, everything.
 * Two people who genuinely share a name never match on all of that, so only
 * exact copies are removed and the first of each is kept.
 */
export const dedupeParticipants = internalMutation({
  args: { registrationNumber: v.string(), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_registrationNumber", (q) =>
        q.eq("registrationNumber", args.registrationNumber.trim()),
      )
      .unique();
    if (registration === null) throw new ConvexError("Registration not found.");

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_registrationId", (q) =>
        q.eq("registrationId", registration._id),
      )
      .collect();

    const fingerprint = (p: Doc<"participants">) =>
      JSON.stringify([
        p.fullName.trim().toLowerCase(),
        (p.preferredName ?? "").trim().toLowerCase(),
        p.age,
        p.gender,
        p.maritalStatus,
        (p.churchOrganization ?? "").trim().toLowerCase(),
        (p.ministryInvolvement ?? "").trim().toLowerCase(),
        (p.occupation ?? "").trim().toLowerCase(),
        (p.mobileNumber ?? "").trim(),
        (p.email ?? "").trim().toLowerCase(),
        (p.cityMunicipality ?? "").trim().toLowerCase(),
        p.breakoutSession,
      ]);

    const kept = new Set<string>();
    const going: Doc<"participants">[] = [];
    for (const participant of participants) {
      const key = fingerprint(participant);
      if (kept.has(key)) going.push(participant);
      else kept.add(key);
    }

    if (args.dryRun === true) {
      return {
        registrationNumber: registration.registrationNumber,
        wouldRemove: going.map((p) => p.fullName),
        remaining: participants.length - going.length,
      };
    }

    for (const participant of going) {
      await ctx.db.delete(participant._id);
    }

    const remaining = participants.length - going.length;
    if (going.length > 0) {
      await ctx.db.patch(registration._id, {
        participantCount: remaining,
        ...(registration.amountUnknown === true
          ? {}
          : {
              totalAmount: calculateTotal(
                registration.registrationType,
                remaining,
              ),
            }),
      });
    }

    return {
      registrationNumber: registration.registrationNumber,
      removed: going.map((p) => p.fullName),
      remaining,
    };
  },
});

// -------------------------------------------------------------- payments

/** Records what actually arrived for one payment reference. */
export const recordPayment = mutation({
  args: {
    reference: v.string(),
    status: v.optional(
      v.union(v.literal("received"), v.literal("unpaid"), v.literal("problem")),
    ),
    amountReceived: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireOrganizer(ctx);

    const reference = args.reference.trim();
    if (reference.length === 0) throw new ConvexError("Missing reference.");
    const status = args.status ?? "received";
    if (!Number.isFinite(args.amountReceived) || args.amountReceived < 0) {
      throw new ConvexError("Enter the amount that arrived, in pesos.");
    }
    if (status === "received" && args.amountReceived <= 0) {
      throw new ConvexError("Enter the amount that arrived, in pesos.");
    }

    const note = (args.note ?? "").trim();
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();

    const next = {
      reference,
      status,
      // A part-payment is still money in the bank. Only "not paid yet" means
      // nothing arrived; "needs sorting" keeps whatever did.
      amountReceived: status === "unpaid" ? 0 : args.amountReceived,
      note: note.length > 0 ? note : undefined,
      verifiedByEmail: me.email,
      verifiedAt: Date.now(),
    };

    if (existing === null) await ctx.db.insert("payments", next);
    else await ctx.db.patch(existing._id, next);
  },
});

/** The same from the command line, once a deposit has been settled by asking. */
export const recordPaymentAs = internalMutation({
  args: {
    reference: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("unpaid"),
      v.literal("problem"),
    ),
    amountReceived: v.number(),
    note: v.optional(v.string()),
    byEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const reference = args.reference.trim();
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();

    const next = {
      reference,
      status: args.status,
      amountReceived: args.status === "unpaid" ? 0 : args.amountReceived,
      note: args.note,
      verifiedByEmail: args.byEmail.toLowerCase().trim(),
      verifiedAt: Date.now(),
    };

    if (existing === null) await ctx.db.insert("payments", next);
    else await ctx.db.patch(existing._id, next);
    return next;
  },
});

/**
 * Removes a payment record from the command line. Used when a mistyped
 * reference is merged into the right one and the old card is left pointing at
 * nobody — an empty deposit that would otherwise sit in the queue for ever.
 */
export const deletePaymentRecord = internalMutation({
  args: { references: v.array(v.string()) },
  handler: async (ctx, args) => {
    const removed: string[] = [];
    const notFound: string[] = [];

    for (const raw of args.references) {
      const reference = raw.trim();
      const existing = await ctx.db
        .query("payments")
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .unique();
      if (existing === null) {
        notFound.push(reference);
        continue;
      }
      await ctx.db.delete(existing._id);
      removed.push(reference);
    }

    return { removed, notFound };
  },
});

/** Undo — puts a reference back into the unreconciled pile. */
export const clearPayment = mutation({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_reference", (q) =>
        q.eq("reference", args.reference.trim()),
      )
      .unique();
    if (existing !== null) await ctx.db.delete(existing._id);
  },
});

// ------------------------------------------------------------ organizer list

export type OrganizerEntry = {
  email: string;
  isOwner: boolean;
  role: "organizer" | "volunteer";
  addedByEmail: string | null;
  addedAt: number | null;
  note: string | null;
  id: Id<"organizers"> | null;
};

export const listOrganizers = query({
  args: {},
  handler: async (ctx): Promise<OrganizerEntry[]> => {
    await requireOrganizer(ctx);

    const owners: OrganizerEntry[] = ownerEmails().map((email) => ({
      email,
      isOwner: true,
      role: "organizer" as const,
      addedByEmail: null,
      addedAt: null,
      note: null,
      id: null,
    }));

    const added: OrganizerEntry[] = (await ctx.db.query("organizers").collect())
      // An owner added to the table too would otherwise show up twice.
      .filter((row) => !ownerEmails().includes(row.email))
      .map((row) => ({
        email: row.email,
        isOwner: false,
        role: (row.role ?? "organizer") as "organizer" | "volunteer",
        addedByEmail: row.addedByEmail,
        addedAt: row._creationTime,
        note: row.note ?? null,
        id: row._id,
      }));

    return [...owners, ...added];
  },
});

export const addOrganizer = mutation({
  args: {
    email: v.string(),
    note: v.optional(v.string()),
    role: v.optional(v.union(v.literal("organizer"), v.literal("volunteer"))),
  },
  handler: async (ctx, args) => {
    const me = await requireOrganizer(ctx);

    const email = args.email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError("That doesn't look like an email address.");
    }
    if (ownerEmails().includes(email)) {
      throw new ConvexError("That account already has access.");
    }

    const existing = await ctx.db
      .query("organizers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing !== null) {
      throw new ConvexError("That account is already an organizer.");
    }

    const note = (args.note ?? "").trim();
    await ctx.db.insert("organizers", {
      email,
      role: args.role ?? "organizer",
      addedByEmail: me.email,
      note: note.length > 0 ? note : undefined,
    });
  },
});

export const removeOrganizer = mutation({
  args: { id: v.id("organizers") },
  handler: async (ctx, args) => {
    const me = await requireOrganizer(ctx);

    const row = await ctx.db.get(args.id);
    if (row === null) return;

    // Removing yourself would lock you out mid-session with no way back.
    if (row.email === me.email) {
      throw new ConvexError("You can't remove your own access.");
    }

    await ctx.db.delete(args.id);
  },
});

export type RegistrationRow = {
  registration: Doc<"registrations">;
  participants: Doc<"participants">[];
};

// ------------------------------------------------------------- sheet sync

export const sheetSyncState = query({
  args: {},
  handler: async (ctx) => {
    await requireOrganizer(ctx);
    return await ctx.db
      .query("syncState")
      .withIndex("by_key", (q) => q.eq("key", "googleSheet"))
      .unique();
  },
});

export const recordSheetSync = internalMutation({
  args: {
    lastStatus: v.union(v.literal("ok"), v.literal("failed")),
    lastError: v.optional(v.string()),
    rows: v.number(),
    byEmail: v.string(),
    at: v.number(),
    imported: v.optional(v.number()),
    importError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncState")
      .withIndex("by_key", (q) => q.eq("key", "googleSheet"))
      .unique();

    const next = {
      key: "googleSheet",
      lastSyncedAt: args.at,
      lastStatus: args.lastStatus,
      lastError: args.lastError,
      rows: args.rows,
      byEmail: args.byEmail,
      imported: args.imported,
      importError: args.importError,
    };

    if (existing === null) await ctx.db.insert("syncState", next);
    else await ctx.db.patch(existing._id, next);
  },
});

/**
 * The Sync button: pull, then push.
 *
 * The old Google Form is still live — its QR codes are already printed and in
 * circulation — so anyone filling it in is invisible here until their row is
 * imported. Syncing therefore pulls new Form responses first, then mirrors
 * everything out to the sheet.
 *
 * A failed pull does not block the push: a Drive hiccup should not also stop
 * the sheet being brought up to date. It is reported instead.
 */
export const syncToSheet = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ rows: number; imported: number; importError?: string }> => {
    const me: Access | null = await ctx.runQuery(api.organizer.whoAmI, {});
    if (me === null) throw new ConvexError("Organizers only.");

    let imported = 0;
    let importError: string | undefined;
    try {
      const pulled = (await ctx.runAction(
        internal.importGoogleForm.run,
        {},
      )) as {
        created?: number;
      };
      imported = pulled.created ?? 0;
    } catch (error) {
      importError =
        error instanceof Error
          ? error.message
          : "Could not read the Google Form.";
    }

    try {
      const result = await ctx.runAction(internal.sheetSync.push, {
        byEmail: me.email,
      });
      await ctx.runMutation(internal.organizer.recordSheetSync, {
        lastStatus: "ok",
        rows: result.rows,
        byEmail: me.email,
        at: Date.now(),
        imported,
        importError,
      });
      return { ...result, imported, importError };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.organizer.recordSheetSync, {
        lastStatus: "failed",
        lastError: message,
        rows: 0,
        byEmail: me.email,
        at: Date.now(),
        imported,
        importError,
      });
      throw new ConvexError(message);
    }
  },
});

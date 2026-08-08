import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
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
  if (added !== null) return { email, isOwner: false };

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

    return { registrations, participants, payments };
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

// -------------------------------------------------------------- payments

/** Records what actually arrived for one payment reference. */
export const recordPayment = mutation({
  args: {
    reference: v.string(),
    amountReceived: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireOrganizer(ctx);

    const reference = args.reference.trim();
    if (reference.length === 0) throw new ConvexError("Missing reference.");
    if (!Number.isFinite(args.amountReceived) || args.amountReceived < 0) {
      throw new ConvexError("Enter the amount that arrived, in pesos.");
    }

    const note = (args.note ?? "").trim();
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();

    const next = {
      reference,
      amountReceived: args.amountReceived,
      note: note.length > 0 ? note : undefined,
      verifiedByEmail: me.email,
      verifiedAt: Date.now(),
    };

    if (existing === null) await ctx.db.insert("payments", next);
    else await ctx.db.patch(existing._id, next);
  },
});

/** Undo — puts a reference back into the unreconciled pile. */
export const clearPayment = mutation({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference.trim()))
      .unique();
    if (existing !== null) await ctx.db.delete(existing._id);
  },
});

// ------------------------------------------------------------ organizer list

export type OrganizerEntry = {
  email: string;
  isOwner: boolean;
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
        addedByEmail: row.addedByEmail,
        addedAt: row._creationTime,
        note: row.note ?? null,
        id: row._id,
      }));

    return [...owners, ...added];
  },
});

export const addOrganizer = mutation({
  args: { email: v.string(), note: v.optional(v.string()) },
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
    };

    if (existing === null) await ctx.db.insert("syncState", next);
    else await ctx.db.patch(existing._id, next);
  },
});

/**
 * The Sync button. An action rather than a mutation because it reaches out to
 * Google, and the result is recorded either way so the dashboard can show what
 * happened rather than swallowing a failure.
 */
export const syncToSheet = action({
  args: {},
  handler: async (ctx): Promise<{ rows: number }> => {
    const me: Access | null = await ctx.runQuery(api.organizer.whoAmI, {});
    if (me === null) throw new ConvexError("Organizers only.");

    try {
      const result = await ctx.runAction(internal.sheetSync.push, {
        byEmail: me.email,
      });
      await ctx.runMutation(internal.organizer.recordSheetSync, {
        lastStatus: "ok",
        rows: result.rows,
        byEmail: me.email,
        at: Date.now(),
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.organizer.recordSheetSync, {
        lastStatus: "failed",
        lastError: message,
        rows: 0,
        byEmail: me.email,
        at: Date.now(),
      });
      throw new ConvexError(message);
    }
  },
});

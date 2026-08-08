import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import {
  breakoutSessionValidator,
  registrationTypeValidator,
} from "./schema";

/**
 * Organizer access is an env allowlist, not a role column — V1 has a handful of
 * organizers and no need for a permissions UI. Every organizer function calls
 * this; the dashboard route guard is convenience, this is the actual boundary.
 */
async function requireOrganizer(ctx: QueryCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Sign in to view registrations.");

  const user = await ctx.db.get(userId);
  const email = user?.email?.toLowerCase().trim();
  if (email === undefined || email.length === 0) {
    throw new ConvexError("Your account has no email address.");
  }

  const allowed = (process.env.ORGANIZER_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.toLowerCase().trim())
    .filter((entry) => entry.length > 0);

  if (!allowed.includes(email)) {
    throw new ConvexError("This account is not an authorized organizer.");
  }

  return email;
}

/** Lets the dashboard render a clean "not authorized" state without throwing. */
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

type Row = {
  registration: Doc<"registrations">;
  participants: Doc<"participants">[];
};

async function loadAll(ctx: QueryCtx): Promise<Row[]> {
  const registrations = await ctx.db.query("registrations").order("desc").collect();

  return await Promise.all(
    registrations.map(async (registration) => ({
      registration,
      participants: await ctx.db
        .query("participants")
        .withIndex("by_registrationId", (q) =>
          q.eq("registrationId", registration._id),
        )
        .collect(),
    })),
  );
}

const filterArgs = {
  search: v.optional(v.string()),
  registrationType: v.optional(registrationTypeValidator),
  breakoutSession: v.optional(breakoutSessionValidator),
  paymentType: v.optional(v.union(v.literal("paid"), v.literal("exempt"))),
  dateFrom: v.optional(v.number()),
  dateTo: v.optional(v.number()),
};

function matches(
  row: Row,
  filters: {
    search?: string;
    registrationType?: string;
    breakoutSession?: number;
    paymentType?: string;
    dateFrom?: number;
    dateTo?: number;
  },
): boolean {
  const { registration, participants } = row;

  if (
    filters.registrationType !== undefined &&
    registration.registrationType !== filters.registrationType
  ) {
    return false;
  }
  if (
    filters.paymentType !== undefined &&
    registration.paymentType !== filters.paymentType
  ) {
    return false;
  }
  if (
    filters.breakoutSession !== undefined &&
    !participants.some((p) => p.breakoutSession === filters.breakoutSession)
  ) {
    return false;
  }
  if (
    filters.dateFrom !== undefined &&
    registration._creationTime < filters.dateFrom
  ) {
    return false;
  }
  if (filters.dateTo !== undefined && registration._creationTime > filters.dateTo) {
    return false;
  }

  const search = (filters.search ?? "").toLowerCase().trim();
  if (search.length > 0) {
    const haystack = [
      registration.registrationNumber,
      registration.groupName ?? "",
      registration.registrantName,
      registration.registrantEmail,
      registration.paymentReference ?? "",
      ...participants.flatMap((p) => [p.fullName, p.preferredName ?? "", p.email]),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  return true;
}

export const list = query({
  args: filterArgs,
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);
    const rows = await loadAll(ctx);
    const filtered = rows.filter((row) => matches(row, args));

    return {
      rows: filtered,
      totals: {
        registrations: filtered.length,
        participants: filtered.reduce(
          (sum, row) => sum + row.registration.participantCount,
          0,
        ),
        amount: filtered.reduce(
          (sum, row) => sum + row.registration.totalAmount,
          0,
        ),
        // Every registration in the filtered set, regardless of filters above.
        allRegistrations: rows.length,
      },
    };
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

/** Signed URLs for proof-of-payment files, resolved only for organizers. */
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

/**
 * §27: the registration survives a Resend outage, so organizers need a way to
 * try again afterwards.
 */
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

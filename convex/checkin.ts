/**
 * The door on the day.
 *
 * Built on the assumption that the network will fail, because it is a church
 * hall with six hundred people arriving inside an hour. The roster is handed
 * to the browser once and everything after that — searching, scanning, marking
 * people in — happens locally. Writes are queued on the device and replayed
 * when the connection comes back.
 *
 * That shapes the API: one query that returns everything, and a mutation that
 * accepts a batch of check-ins which may be minutes or hours old.
 */

import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { breakoutTitle } from "./shared";

/**
 * Who may work the door: owners, organizers, and volunteers alike.
 *
 * Deliberately wider than the organizer check used everywhere else. A
 * volunteer gets here and nowhere else — the money, the groups and the
 * personal details all sit behind `requireOrganizer` in convex/organizer.ts,
 * which refuses them.
 */
async function requireDoor(ctx: QueryCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Sign in to work the door.");
  const user = await ctx.db.get(userId);
  const email = user?.email?.toLowerCase().trim();
  if (email === undefined || email.length === 0) {
    throw new ConvexError("Sign in to work the door.");
  }

  const owners = (process.env.ORGANIZER_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.toLowerCase().trim())
    .filter((entry) => entry.length > 0);
  if (owners.includes(email)) return email;

  const added = await ctx.db
    .query("organizers")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (added === null) {
    throw new ConvexError("This account is not on the door list.");
  }
  return email;
}

/** Whether this account may open the door screen at all. */
export const amIOnTheDoor = query({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    try {
      await requireDoor(ctx);
      return true;
    } catch {
      return false;
    }
  },
});

export type RosterEntry = {
  id: string;
  name: string;
  /** Lowercased name and group, so the device can match without re-deriving. */
  search: string;
  group: string;
  registrationNumber: string;
  session: string;
  /** Just the number, for a room sign or a lanyard. */
  sessionNumber: number;
  church: string;
  // Enough to settle a "that's not me" at the desk without a second device.
  goesBy: string;
  age: number | null;
  city: string;
  mobile: string;
  email: string;
  /** False when the deposit covering them has not been settled. */
  cleared: boolean;
  checkedInAt: number | null;
};

/**
 * Everything the door needs, in one payload small enough to keep on a phone.
 *
 * Deliberately flat and pre-formatted: once this is cached the device must not
 * need any of the pricing or grouping logic to show a person and their room.
 */
export const roster = query({
  args: {},
  handler: async (ctx): Promise<{ at: number; people: RosterEntry[] }> => {
    await requireDoor(ctx);

    const registrations = await ctx.db.query("registrations").collect();
    const participants = await ctx.db.query("participants").collect();
    const payments = await ctx.db.query("payments").collect();
    const checkIns = await ctx.db.query("checkIns").collect();

    const byId = new Map(registrations.map((r) => [r._id, r]));
    const paymentFor = new Map(payments.map((p) => [p.reference, p]));
    // Earliest wins: a second scan of the same person is not a second arrival.
    const arrived = new Map<string, number>();
    for (const entry of checkIns) {
      const existing = arrived.get(entry.participantId);
      if (existing === undefined || entry.at < existing) {
        arrived.set(entry.participantId, entry.at);
      }
    }

    const people = participants.map((participant): RosterEntry => {
      const registration = byId.get(participant.registrationId);
      const group = registration?.groupName ?? "";
      const reference = (registration?.paymentReference ?? "").trim();
      const record = paymentFor.get(reference);

      // Exempt people owe nothing, so there is nothing to settle. For everyone
      // else the door only needs to know whether the money landed, not how
      // much — the amount is the office's problem, not the queue's.
      const cleared =
        registration?.paymentType !== "paid" ||
        (record !== undefined && (record.status ?? "received") === "received");

      return {
        id: participant._id,
        name: participant.fullName,
        // The registration number is searchable too: it is what the
        // confirmation email shows, so people read it out at the door.
        search: `${participant.fullName} ${group} ${participant.churchOrganization ?? ""} ${registration?.registrationNumber ?? ""}`
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim(),
        group,
        registrationNumber: registration?.registrationNumber ?? "",
        session: `${participant.breakoutSession}. ${breakoutTitle(participant.breakoutSession)}`,
        sessionNumber: participant.breakoutSession,
        church: participant.churchOrganization ?? "",
        goesBy: participant.preferredName ?? "",
        age: participant.age ?? null,
        city: participant.cityMunicipality ?? "",
        mobile: participant.mobileNumber ?? "",
        email: participant.email ?? "",
        cleared,
        checkedInAt: arrived.get(participant._id) ?? null,
      };
    });

    people.sort((a, b) => a.name.localeCompare(b.name));
    return { at: Date.now(), people };
  },
});

/**
 * Marks people in. Takes a batch because a phone that has been offline comes
 * back with several, and each carries the time it actually happened.
 *
 * Idempotent per participant: scanning someone twice, or two doors scanning the
 * same person, keeps the earliest arrival and adds nothing.
 */
export const checkIn = mutation({
  args: {
    entries: v.array(
      v.object({
        participantId: v.id("participants"),
        at: v.number(),
        queued: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const email = await requireDoor(ctx);

    const recorded: string[] = [];
    const alreadyIn: string[] = [];

    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("checkIns")
        .withIndex("by_participantId", (q) =>
          q.eq("participantId", entry.participantId),
        )
        .collect();

      if (existing.length > 0) {
        // Keep the earliest time we have heard for them. A queued row from the
        // door can arrive after a later scan somewhere else.
        const earliest = Math.min(...existing.map((row) => row.at));
        if (entry.at < earliest) {
          await ctx.db.patch(existing[0]._id, { at: entry.at });
        }
        alreadyIn.push(entry.participantId);
        continue;
      }

      await ctx.db.insert("checkIns", {
        participantId: entry.participantId,
        at: entry.at,
        byEmail: email,
        queued: entry.queued,
      });
      recorded.push(entry.participantId);
    }

    return { recorded: recorded.length, alreadyIn: alreadyIn.length };
  },
});

/** Undo, for the inevitable wrong tap in a queue. */
export const undoCheckIn = mutation({
  args: { participantId: v.id("participants") },
  handler: async (ctx, args) => {
    await requireDoor(ctx);
    for (const row of await ctx.db
      .query("checkIns")
      .withIndex("by_participantId", (q) =>
        q.eq("participantId", args.participantId),
      )
      .collect()) {
      await ctx.db.delete(row._id);
    }
  },
});

/**
 * One person's door pass, by participant id.
 *
 * Public on purpose. Most attendees cannot sign in — three quarters were
 * registered by a coordinator, and 26 have no email at all — so a pass behind
 * a login would be a pass most people could never reach. The id is a random
 * 32-character string, so the link is the secret, exactly like a ticket link.
 *
 * Returns only what a door pass needs. No email, no mobile, no age, nothing
 * about money: a link forwarded to the wrong chat should reveal a name and a
 * room, not a person's contact details.
 */
export const pass = query({
  args: { participantId: v.string() },
  handler: async (ctx, args) => {
    // Fetched by id, not scanned for. Every pass view was reading all six
    // hundred participant rows, and four hundred emails are about to point
    // people at this.
    const id = ctx.db.normalizeId("participants", args.participantId.trim());
    if (id === null) return null;
    const participant = await ctx.db.get(id);
    if (participant === null) return null;

    const registration = await ctx.db.get(participant.registrationId);

    return {
      id: participant._id,
      name: participant.fullName,
      session: `${participant.breakoutSession}. ${breakoutTitle(participant.breakoutSession)}`,
      registrationNumber: registration?.registrationNumber ?? "",
      group: registration?.groupName ?? "",
    };
  },
});

/** Every pass on one registration, for the page the confirmation email links to. */
export const passesFor = query({
  args: { registrationNumber: v.string() },
  handler: async (ctx, args) => {
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_registrationNumber", (q) =>
        q.eq("registrationNumber", args.registrationNumber.trim()),
      )
      .unique();
    if (registration === null) return null;

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_registrationId", (q) =>
        q.eq("registrationId", registration._id),
      )
      .collect();

    return {
      registrationNumber: registration.registrationNumber,
      group: registration.groupName ?? "",
      people: participants.map((participant) => ({
        id: participant._id,
        name: participant.fullName,
        session: `${participant.breakoutSession}. ${breakoutTitle(participant.breakoutSession)}`,
      })),
    };
  },
});

/**
 * Wipes every check-in.
 *
 * For clearing test arrivals before the day. Deliberately internal and
 * deliberately all-or-nothing: there is no reason to half-reset a door, and
 * the undo on a single person already exists for real mistakes.
 *
 *   npx convex run checkin:clearAll '{"confirm":"yes"}' --prod
 */
export const clearAll = internalMutation({
  args: { confirm: v.string() },
  handler: async (ctx, args) => {
    if (args.confirm !== "yes") {
      throw new ConvexError('Pass {"confirm":"yes"} to clear every check-in.');
    }
    const rows = await ctx.db.query("checkIns").collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return { cleared: rows.length };
  },
});

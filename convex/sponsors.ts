/**
 * Seats a sponsor paid for before knowing who would sit in them.
 *
 * A sponsor buys ten slots in July and still has no names in September. The
 * names only exist at the door, spoken by whoever turns up holding the ticket.
 *
 * So a slot is stored as an ordinary participant with an empty name, under one
 * registration per sponsoring organization. That is the whole trick: the seats
 * are already on the roster, already counted, already carried offline by every
 * door phone, and claiming one is nothing more exotic than writing a name into
 * a record that was always there. Nothing downstream — the roster, check-ins,
 * the sheet, the counts — needs to know sponsors exist.
 *
 * Each organization gets one code, printed on whatever ticket graphic they
 * send out. Scanning it does not identify a person, because there is no person
 * to identify: it opens that sponsor's seats and asks for a name.
 */

import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { allocateRegistrationNumber } from "./registrations";
import { requireOrganizer } from "./organizer";
import { requireDoor } from "./checkin";

/** Bounded so a typo in the seat count cannot insert ten thousand rows. */
const MAX_SEATS = 200;

/**
 * Creates a sponsor and its empty seats.
 *
 * Exempt, because the sponsorship is the payment. Everyone lands in session 1,
 * the plenary, which is where anyone registering now goes anyway — a sponsor's
 * guest can be moved afterwards like anybody else.
 */
export const createPool = mutation({
  args: {
    org: v.string(),
    seats: v.number(),
    /**
     * "sponsor" is seats somebody paid for. "walkin" is the spare seats the
     * door keeps for people who are not on the list at all — the same
     * machinery, because the problem is the same one: a person in front of you
     * with no record behind them.
     */
    kind: v.optional(v.union(v.literal("sponsor"), v.literal("walkin"))),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { email } = await requireOrganizer(ctx);

    const org = args.org.trim();
    if (org.length === 0) throw new ConvexError("Name the sponsor.");
    if (!Number.isInteger(args.seats) || args.seats < 1) {
      throw new ConvexError("How many seats? It has to be a whole number.");
    }
    if (args.seats > MAX_SEATS) {
      throw new ConvexError(`That is more than ${MAX_SEATS} seats.`);
    }

    const walkIn = args.kind === "walkin";
    const registrationNumber = await allocateRegistrationNumber(ctx);
    const registrationId = await ctx.db.insert("registrations", {
      registrationNumber,
      idempotencyKey: `sponsor-${registrationNumber}`,
      groupName: org,
      registrantName: org,
      registrantEmail: "",
      registrationType: walkIn ? "regular" : "sponsor",
      participantCount: args.seats,
      totalAmount: 0,
      source: "organizer",
      // A walk-in owes the fee until somebody says otherwise, and saying they
      // are exempt would quietly write off money nobody agreed to write off.
      // The amount is unknown because it depends on who they turn out to be.
      ...(walkIn
        ? { paymentType: "paid" as const, amountUnknown: true }
        : {
            paymentType: "exempt" as const,
            exemptionReason: "sponsor" as const,
          }),
      confirmationEmailStatus: "sent",
      ...(args.note === undefined ? {} : { heardFromRaw: args.note }),
    });

    for (let index = 0; index < args.seats; index++) {
      await ctx.db.insert("participants", {
        registrationId,
        fullName: "",
        breakoutSession: 1,
        churchOrganization: org,
        seat: true,
      });
    }

    return { registrationNumber, seats: args.seats, byEmail: email };
  },
});

/**
 * The same thing from the command line, for setting several sponsors up at
 * once without clicking through the dashboard:
 *
 *   npx convex run sponsors:createPoolAs '{"org":"Acme","seats":10}' --prod
 */
export const createPoolAs = internalMutation({
  args: {
    org: v.string(),
    seats: v.number(),
    kind: v.optional(v.union(v.literal("sponsor"), v.literal("walkin"))),
  },
  handler: async (ctx, args): Promise<{ registrationNumber: string }> => {
    const registrationNumber = await allocateRegistrationNumber(ctx);
    const registrationId = await ctx.db.insert("registrations", {
      registrationNumber,
      idempotencyKey: `sponsor-${registrationNumber}`,
      groupName: args.org.trim(),
      registrantName: args.org.trim(),
      registrantEmail: "",
      registrationType: args.kind === "walkin" ? "regular" : "sponsor",
      participantCount: args.seats,
      totalAmount: 0,
      source: "organizer",
      ...(args.kind === "walkin"
        ? { paymentType: "paid" as const, amountUnknown: true }
        : {
            paymentType: "exempt" as const,
            exemptionReason: "sponsor" as const,
          }),
      confirmationEmailStatus: "sent",
    });
    for (let index = 0; index < args.seats; index++) {
      await ctx.db.insert("participants", {
        registrationId,
        fullName: "",
        breakoutSession: 1,
        churchOrganization: args.org.trim(),
        seat: true,
      });
    }
    return { registrationNumber };
  },
});

/** More seats on an existing sponsor, for when they buy another five. */
export const addSeats = mutation({
  args: { registrationNumber: v.string(), seats: v.number() },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx);
    if (!Number.isInteger(args.seats) || args.seats < 1) {
      throw new ConvexError("How many seats? It has to be a whole number.");
    }

    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_registrationNumber", (q) =>
        q.eq("registrationNumber", args.registrationNumber.trim()),
      )
      .unique();
    if (registration === null) throw new ConvexError("No such sponsor.");

    const existing = await ctx.db
      .query("participants")
      .withIndex("by_registrationId", (q) =>
        q.eq("registrationId", registration._id),
      )
      .collect();
    if (existing.length + args.seats > MAX_SEATS) {
      throw new ConvexError(`That would pass ${MAX_SEATS} seats.`);
    }

    for (let index = 0; index < args.seats; index++) {
      await ctx.db.insert("participants", {
        registrationId: registration._id,
        fullName: "",
        breakoutSession: 1,
        churchOrganization: registration.groupName ?? "",
        seat: true,
      });
    }

    await ctx.db.patch(registration._id, {
      participantCount: existing.length + args.seats,
    });
    return { seats: existing.length + args.seats };
  },
});

/**
 * Writes a name into a seat. Run from the door, so it takes the door check
 * rather than the organizer one.
 *
 * Deliberately separate from checking in. A phone with no signal can mark the
 * seat as arrived straight away and send the name later; the arrival is the
 * fact that matters on the day, and a name typed into a queue can wait.
 */
export const claimSeat = mutation({
  args: {
    participantId: v.id("participants"),
    name: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireDoor(ctx);

    const participant = await ctx.db.get(args.participantId);
    if (participant === null) throw new ConvexError("No such seat.");
    if (participant.seat !== true) {
      throw new ConvexError("That is somebody's registration, not a seat.");
    }

    await ctx.db.patch(args.participantId, {
      fullName: args.name.trim(),
      ...(args.note === undefined ? {} : { seatNote: args.note.trim() }),
    });
    return { ok: true };
  },
});

/**
 * Writing a name into a seat from the command line, for the one somebody
 * mistyped at the door:
 *
 *   npx convex run sponsors:claimSeatAs '{"registrationNumber":"CG26-00091","index":3,"name":"Ptr Ray Tonsay"}' --prod
 */
export const claimSeatAs = internalMutation({
  args: {
    registrationNumber: v.string(),
    /** Which seat, counting from 1 in the order they were created. */
    index: v.number(),
    name: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_registrationNumber", (q) =>
        q.eq("registrationNumber", args.registrationNumber.trim()),
      )
      .unique();
    if (registration === null) throw new ConvexError("No such sponsor.");

    const seats = await ctx.db
      .query("participants")
      .withIndex("by_registrationId", (q) =>
        q.eq("registrationId", registration._id),
      )
      .collect()
      .then((rows) => rows.filter((row) => row.seat === true));

    const seat = seats[args.index - 1];
    if (seat === undefined) throw new ConvexError(`No seat ${args.index}.`);

    await ctx.db.patch(seat._id, {
      fullName: args.name.trim(),
      ...(args.note === undefined ? {} : { seatNote: args.note.trim() }),
    });
    return { seat: args.index, name: args.name.trim() };
  },
});

/** Every sponsor and how many of its seats have names, for the dashboard. */
export const pools = query({
  args: {},
  handler: async (ctx) => {
    await requireOrganizer(ctx);

    const registrations = await ctx.db
      .query("registrations")
      .collect()
      .then((rows) => rows.filter((row) => row.registrationType === "sponsor"));

    const out = [];
    for (const registration of registrations) {
      const seats = await ctx.db
        .query("participants")
        .withIndex("by_registrationId", (q) =>
          q.eq("registrationId", registration._id),
        )
        .collect()
        .then((rows) => rows.filter((row) => row.seat === true));
      if (seats.length === 0) continue;

      out.push({
        registrationNumber: registration.registrationNumber,
        org: registration.groupName ?? registration.registrantName,
        walkIn: registration.registrationType !== "sponsor",
        seats: seats.length,
        claimed: seats.filter((row) => row.fullName.trim().length > 0).length,
        // Who came in on them, so the sponsor's list and the walk-in list are
        // both answerable from one page rather than from the spreadsheet.
        people: seats
          .filter(
            (row) =>
              row.fullName.trim().length > 0 ||
              (row.seatNote ?? "").trim().length > 0,
          )
          .map((row) => ({
            name: row.fullName.trim(),
            note: (row.seatNote ?? "").trim(),
          })),
      });
    }
    out.sort((a, b) => a.org.localeCompare(b.org));
    return out;
  },
});

/**
 * One sponsor's seats, for the page their ticket code points at.
 *
 * Public, and deliberately thin: the organization's name, its code, and how
 * many seats are left. No names, because the people who claimed those seats
 * did not agree to appear on a page a ticket links to.
 */
export const pool = query({
  args: { registrationNumber: v.string() },
  handler: async (ctx, args) => {
    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_registrationNumber", (q) =>
        q.eq("registrationNumber", args.registrationNumber.trim()),
      )
      .unique();
    if (registration === null || registration.registrationType !== "sponsor") {
      return null;
    }

    const seats = await ctx.db
      .query("participants")
      .withIndex("by_registrationId", (q) =>
        q.eq("registrationId", registration._id),
      )
      .collect()
      .then((rows) => rows.filter((row) => row.seat === true));
    if (seats.length === 0) return null;

    return {
      registrationNumber: registration.registrationNumber,
      org: registration.groupName ?? registration.registrantName,
      seats: seats.length,
      claimed: seats.filter((row) => row.fullName.trim().length > 0).length,
    };
  },
});

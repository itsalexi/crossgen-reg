"use client";

import { useRef, useState } from "react";
import type { RosterEntry } from "@convex/checkin";

/**
 * A sponsor's seats, at the door.
 *
 * The sponsor paid for ten slots and never sent ten names, so there is nobody
 * to look up: the person standing there is the first anyone has heard of them.
 * One question, then — what is your name — and the seat is theirs.
 *
 * A name is not required. A queue that stops while somebody spells their
 * surname is worse than a seat recorded as used with nobody's name on it, and
 * the name can be filled in afterwards from the dashboard.
 */

const PURPLE = "#3e2a85";
const BORDER = "#c9c2dd";
const HAIRLINE = "#ddd8e8";
const BODY = "#4a4460";
const TEAL = "#1d5f78";
const TEAL_TINT = "#e8f4f8";

function at(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SponsorSheet({
  org,
  seats,
  isIn,
  onClaim,
  onUndo,
  onClose,
  walkIn = false,
}: {
  org: string;
  seats: RosterEntry[];
  isIn: (entry: RosterEntry) => boolean;
  /** Writes the name into the seat and marks it arrived, in that order. */
  onClaim: (seat: RosterEntry, name: string, note: string) => void;
  onUndo: (seat: RosterEntry) => void;
  onClose: () => void;
  /**
   * Spare seats for people with no record at all, rather than a sponsor's.
   * Same machinery; the difference is that somebody has to sort them out
   * afterwards, so the door is asked for a word about who they were.
   */
  walkIn?: boolean;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const field = useRef<HTMLInputElement | null>(null);

  const used = seats.filter(
    (seat) => isIn(seat) || seat.name.trim().length > 0,
  );
  const free = seats.filter(
    (seat) => !isIn(seat) && seat.name.trim().length === 0,
  );
  const next = free[0] ?? null;

  const claim = () => {
    if (next === null) return;
    onClaim(next, name, note);
    setName("");
    setNote("");
    field.current?.focus();
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pt-3 pb-5">
        <p
          className="text-[15px] leading-none font-semibold"
          style={{ color: PURPLE }}
        >
          {walkIn ? "Not on the list" : "Sponsor seats"}
        </p>
        <p className="mt-2 font-display text-[29px] leading-[1.12] font-bold text-ink">
          {org}
        </p>
        <p className="mt-1.5 text-[17px] leading-[1.35]" style={{ color: BODY }}>
          {used.length} of {seats.length} used
          {free.length > 0 ? ` · ${free.length} left` : ""}
        </p>

        {next === null ? (
          <div
            className="mt-5 rounded-2xl px-4 py-4"
            style={{ background: "#fff6dd", border: "2px solid #f0d68a" }}
          >
            <p
              className="text-[17px] leading-[1.3] font-semibold"
              style={{ color: "#7a5c00" }}
            >
              Every seat is used
            </p>
            <p
              className="mt-1 text-[16px] leading-[1.45]"
              style={{ color: "#6b5200" }}
            >
              {walkIn
                ? "Let them in and take their name on paper. An organizer can add more seats in a few seconds."
                : "Let them in anyway and tell the registration table — a seat can be added there in a few seconds."}
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <label
              htmlFor="sponsor-name"
              className="text-[17px] leading-none font-semibold text-ink"
            >
              Their name
            </label>
            <input
              id="sponsor-name"
              ref={field}
              autoFocus
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint={walkIn ? "next" : "done"}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !walkIn) claim();
              }}
              placeholder="As they say it"
              className="mt-2.5 h-[68px] w-full rounded-xl px-4 text-[19px] text-ink"
              style={{ border: `2px solid ${BORDER}` }}
            />

            {/* One line for whoever picks this up on Monday: which church,
                whether they paid at the table, whose guest they are. */}
            {walkIn && (
              <>
                <label
                  htmlFor="seat-note"
                  className="mt-4 block text-[17px] leading-none font-semibold text-ink"
                >
                  What are they? <span style={{ color: BODY }}>Optional</span>
                </label>
                <input
                  id="seat-note"
                  autoComplete="off"
                  enterKeyHint="done"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") claim();
                  }}
                  placeholder="Church, or paid at the table"
                  className="mt-2.5 h-[68px] w-full rounded-xl px-4 text-[19px] text-ink"
                  style={{ border: `2px solid ${BORDER}` }}
                />
              </>
            )}
          </div>
        )}

        {/* Who has come in on this sponsor's seats, and the way to undo a
            wrong one. The sponsor will ask for exactly this list. */}
        {used.length > 0 && (
          <div className="mt-6">
            <p
              className="text-[16px] leading-none font-semibold"
              style={{ color: BODY }}
            >
              In on these seats
            </p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {used.map((seat, index) => (
                <li
                  key={seat.id}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ background: TEAL_TINT, border: `2px solid ${TEAL_TINT}` }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[18px] leading-[1.25] font-semibold text-ink">
                      {seat.name.trim().length > 0
                        ? seat.name
                        : `Seat ${index + 1}, no name given`}
                    </span>
                    <span
                      className="block text-[15px] leading-[1.3]"
                      style={{ color: TEAL }}
                    >
                      {isIn(seat)
                        ? `In ${seat.checkedInAt !== null ? at(seat.checkedInAt) : "just now"}`
                        : "Name taken, not arrived"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onUndo(seat)}
                    className="flex-none rounded-xl bg-white px-3.5 py-2.5 text-[15px] font-semibold"
                    style={{ border: `2px solid ${TEAL}`, color: TEAL }}
                  >
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div
        className="flex-none border-t bg-white px-[18px] pt-3 pb-4"
        style={{ borderColor: HAIRLINE }}
      >
        {next === null ? (
          <button
            type="button"
            onClick={onClose}
            className="h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
            style={{ background: PURPLE }}
          >
            Next person
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={claim}
              className="h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
              style={{ background: PURPLE }}
            >
              {name.trim().length > 0 ? "Check in" : "Check in without a name"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2.5 h-[52px] w-full rounded-xl text-[18px] font-semibold"
              style={{ border: `2px solid ${BORDER}`, color: PURPLE }}
            >
              Done
            </button>
          </>
        )}
      </div>
    </>
  );
}

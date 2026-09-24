"use client";

import { useRef, useState } from "react";
import type { RosterEntry } from "@convex/checkin";

/**
 * Seats that were paid for before anybody knew who would sit in them.
 *
 * Two ways in, because two different things happen at a door. A sponsor sends
 * eighty people and nobody is going to type eighty names: that is a headcount,
 * counted up and down as they file past. A walk-in is one person nobody has
 * ever heard of, and their name is the only thing that will make sense of them
 * on Monday.
 *
 * So counting leads for a sponsor and naming leads for a walk-in, and either
 * can reach the other in one tap. A seat claimed without a name is still a
 * seat claimed: it counts, it can be undone, and a name can be written into it
 * afterwards from the dashboard.
 */

const PURPLE = "#3e2a85";
const BORDER = "#c9c2dd";
const HAIRLINE = "#ddd8e8";
const BODY = "#4a4460";
const FAINT = "#6e6885";
const TEAL = "#1d5f78";
const TEAL_TINT = "#e8f4f8";

function at(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // The number on screen is the feedback that matters.
  }
}

export function SponsorSheet({
  org,
  seats,
  isIn,
  onClaim,
  onCount,
  onUndo,
  onClose,
  walkIn = false,
}: {
  org: string;
  seats: RosterEntry[];
  isIn: (entry: RosterEntry) => boolean;
  /** One person, with their name. */
  onClaim: (seat: RosterEntry, name: string, note: string) => void;
  /** Several at once, nameless — the headcount. */
  onCount: (seats: RosterEntry[]) => void;
  onUndo: (seat: RosterEntry) => void;
  onClose: () => void;
  walkIn?: boolean;
}) {
  const [naming, setNaming] = useState(walkIn);
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

  // Most recent first: undoing means undoing the last tap, nearly always.
  const recent = [...used].sort(
    (a, b) => (b.checkedInAt ?? Infinity) - (a.checkedInAt ?? Infinity),
  );

  const claim = () => {
    if (next === null) return;
    onClaim(next, name, note);
    setName("");
    setNote("");
    field.current?.focus();
  };

  const add = (howMany: number) => {
    const taking = free.slice(0, howMany);
    if (taking.length === 0) return;
    buzz(taking.length > 1 ? [18, 50, 18] : 18);
    onCount(taking);
  };

  const removeLast = () => {
    const last = recent[0];
    if (last === undefined) return;
    buzz(10);
    onUndo(last);
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

        {next === null ? (
          <div
            className="mt-4 rounded-2xl px-4 py-4"
            style={{ background: "#fff6dd", border: "2px solid #f0d68a" }}
          >
            <p
              className="text-[17px] leading-[1.3] font-semibold"
              style={{ color: "#7a5c00" }}
            >
              All {seats.length} seats are used
            </p>
            <p
              className="mt-1 text-[16px] leading-[1.45]"
              style={{ color: "#6b5200" }}
            >
              Let them in anyway and tell the registration table. More seats can
              be added there in a few seconds.
            </p>
          </div>
        ) : naming ? (
          <div className="mt-5">
            <p className="text-[17px] leading-[1.35]" style={{ color: BODY }}>
              {used.length} of {seats.length} in · {free.length} left
            </p>

            <label
              htmlFor="sponsor-name"
              className="mt-4 block text-[17px] leading-none font-semibold text-ink"
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
        ) : (
          /* The headcount. One number, made big enough to read at arm's length
             while a queue walks past, and two buttons either side of it. */
          <div className="mt-5">
            <p
              className="text-center text-[17px] leading-none font-semibold"
              style={{ color: BODY }}
            >
              How many are in
            </p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={removeLast}
                disabled={used.length === 0}
                aria-label="One fewer"
                className="h-[92px] flex-1 rounded-2xl text-[44px] leading-none font-semibold disabled:opacity-30"
                style={{
                  background: "#fff",
                  border: `2px solid ${BORDER}`,
                  color: PURPLE,
                }}
              >
                −
              </button>

              <span className="flex min-w-[104px] flex-col items-center">
                <span
                  className="font-display text-[64px] leading-none font-bold tabular-nums"
                  style={{ color: PURPLE }}
                >
                  {used.length}
                </span>
                <span
                  className="mt-1 text-[16px] leading-none font-medium"
                  style={{ color: BODY }}
                >
                  of {seats.length}
                </span>
              </span>

              <button
                type="button"
                onClick={() => add(1)}
                aria-label="One more"
                className="h-[92px] flex-1 rounded-2xl text-[44px] leading-none font-semibold text-white"
                style={{ background: PURPLE }}
              >
                +
              </button>
            </div>

            {/* A van arrives with twelve people in it. */}
            <div className="mt-2.5 flex gap-2.5">
              {[5, 10].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => add(step)}
                  disabled={free.length === 0}
                  className="h-[52px] flex-1 rounded-xl text-[18px] font-semibold disabled:opacity-30"
                  style={{
                    background: "#fff",
                    border: `2px solid ${BORDER}`,
                    color: PURPLE,
                  }}
                >
                  +{step}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[16px] leading-[1.45]" style={{ color: FAINT }}>
              {free.length} seats left. Tap minus to take the last one back.
            </p>
          </div>
        )}

        {/* Only shown once there is something to show. An empty panel under an
            empty list was the thing that looked broken. */}
        {recent.length > 0 && (
          <div className="mt-6">
            <p
              className="text-[16px] leading-none font-semibold"
              style={{ color: BODY }}
            >
              {recent.length === 1 ? "The one in" : `The last few of ${used.length}`}
            </p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {recent.slice(0, 6).map((seat, index) => (
                <li
                  key={seat.id}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ background: TEAL_TINT }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[18px] leading-[1.25] font-semibold text-ink">
                      {seat.name.trim().length > 0
                        ? seat.name
                        : `No name given`}
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
            {used.length > 6 && (
              <p className="mt-2.5 text-[15px]" style={{ color: FAINT }}>
                {used.length - 6} more already in.
              </p>
            )}
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
        ) : naming ? (
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
              onClick={() => (walkIn ? onClose() : setNaming(false))}
              className="mt-2.5 h-[52px] w-full rounded-xl text-[18px] font-semibold"
              style={{ border: `2px solid ${BORDER}`, color: PURPLE }}
            >
              {walkIn ? "Done" : "Just count them instead"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
              style={{ background: PURPLE }}
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => {
                setNaming(true);
                setTimeout(() => field.current?.focus(), 0);
              }}
              className="mt-2.5 h-[52px] w-full rounded-xl text-[18px] font-semibold"
              style={{ border: `2px solid ${BORDER}`, color: PURPLE }}
            >
              Someone gave a name
            </button>
          </>
        )}
      </div>
    </>
  );
}

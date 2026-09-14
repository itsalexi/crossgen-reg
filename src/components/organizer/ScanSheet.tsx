"use client";

import { useEffect, useRef } from "react";
import type { RosterEntry } from "@convex/checkin";

/**
 * What a scanned code turns into.
 *
 * Four things, in the order the door needs them: whether this person is in,
 * who they are, where to send them, and who else is on their registration.
 * The action sits in a footer that never scrolls away, and the undo lives
 * inside the confirmation itself — the one place somebody looks after
 * realising they just checked in the wrong person.
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

function firstName(person: RosterEntry): string {
  const goesBy = person.goesBy.trim();
  if (goesBy.length > 0) return goesBy;
  return person.name.trim().split(/\s+/)[0].replace(/,$/, "");
}

export function ScanSheet({
  person,
  people,
  isIn,
  onCheckIn,
  onUndo,
  onClose,
}: {
  person: RosterEntry;
  people: RosterEntry[];
  isIn: (entry: RosterEntry) => boolean;
  onCheckIn: (entry: RosterEntry) => void;
  onUndo: (entry: RosterEntry) => void;
  onClose: () => void;
}) {
  const inside = isIn(person);
  const family = people.filter(
    (entry) =>
      entry.registrationNumber === person.registrationNumber &&
      entry.id !== person.id,
  );
  const waiting = family.filter((entry) => !isIn(entry)).length;

  // Checking somebody in from halfway down a long family list would otherwise
  // put the confirmation somewhere the volunteer is not looking.
  const body = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (inside) body.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [inside]);

  return (
    <>
      <div
        ref={body}
        className="min-h-0 flex-1 overflow-y-auto px-[18px] pt-3 pb-5"
      >
        {/* The confirmation. Wide, coloured, and carrying its own undo, so
            "I just checked in the wrong person" is one tap from where the
            mistake appeared rather than hidden at the bottom of a page. */}
        {inside ? (
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
            style={{ background: TEAL_TINT }}
          >
            <span
              className="flex size-9 flex-none items-center justify-center rounded-full text-[20px] leading-none font-bold text-white"
              style={{ background: TEAL }}
            >
              ✓
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[18px] leading-[1.2] font-semibold"
                style={{ color: TEAL }}
              >
                Checked in
              </span>
              <span
                className="block text-[15px] leading-[1.3]"
                style={{ color: TEAL }}
              >
                {person.checkedInAt !== null
                  ? at(person.checkedInAt)
                  : "just now"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onUndo(person)}
              className="flex-none rounded-xl bg-white px-4 py-3 text-[16px] font-semibold"
              style={{ border: `2px solid ${TEAL}`, color: TEAL }}
            >
              Undo
            </button>
          </div>
        ) : (
          <p
            className="text-[16px] leading-none font-semibold"
            style={{ color: BODY }}
          >
            Not checked in yet
          </p>
        )}

        <p className="mt-3.5 font-display text-[29px] leading-[1.12] font-bold text-ink">
          {person.name}
        </p>
        <p className="mt-1 text-[16px] leading-[1.35]" style={{ color: BODY }}>
          {[
            person.group.length > 0 ? person.group : person.church,
            person.registrationNumber,
          ]
            .filter((part) => part.length > 0)
            .join(" · ")}
        </p>

        {/* The line that gets said out loud, boxed so it is found without
            reading anything else on the sheet. */}
        <div
          className="mt-5 rounded-2xl px-4 py-4"
          style={{ background: "#f2effb" }}
        >
          <p
            className="text-[15px] leading-none font-semibold"
            style={{ color: PURPLE }}
          >
            Send them to
          </p>
          <p className="mt-2 font-display text-[22px] leading-[1.25] font-semibold text-ink">
            {person.session}
          </p>
        </div>

        {!person.cleared && (
          <div
            className="mt-4 rounded-2xl px-4 py-3.5"
            style={{ background: "#fff6dd", border: "2px solid #f0d68a" }}
          >
            <p
              className="text-[17px] leading-[1.3] font-semibold"
              style={{ color: "#7a5c00" }}
            >
              Payment not finished
            </p>
            <p
              className="mt-1 text-[16px] leading-[1.45]"
              style={{ color: "#6b5200" }}
            >
              Let them in. Nothing to collect here.
            </p>
          </div>
        )}

        {/* Open by default. A family of five arrives at the door together, and
            a list behind a "Show" link is a list nobody opens. */}
        {family.length > 0 && (
          <div className="mt-6">
            <p
              className="text-[16px] leading-none font-semibold"
              style={{ color: BODY }}
            >
              {waiting > 0
                ? `${family.length} more on this registration, ${waiting} still to check in`
                : `Everyone else on this registration is in`}
            </p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {family.map((entry) => {
                const here = isIn(entry);
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{
                      background: here ? TEAL_TINT : "#fff",
                      border: `2px solid ${here ? TEAL_TINT : HAIRLINE}`,
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[18px] leading-[1.25] font-semibold text-ink">
                        {entry.name}
                      </span>
                      <span
                        className="block text-[15px] leading-[1.3]"
                        style={{ color: here ? TEAL : BODY }}
                      >
                        {here
                          ? `In ${entry.checkedInAt !== null ? at(entry.checkedInAt) : "just now"}`
                          : `Session ${entry.sessionNumber}`}
                      </span>
                    </span>
                    {here ? (
                      <button
                        type="button"
                        onClick={() => onUndo(entry)}
                        className="flex-none rounded-xl bg-white px-3.5 py-2.5 text-[15px] font-semibold"
                        style={{ border: `2px solid ${TEAL}`, color: TEAL }}
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onCheckIn(entry)}
                        className="flex-none rounded-xl px-4 py-3 text-[16px] font-semibold text-white"
                        style={{ background: PURPLE }}
                      >
                        Check in
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <a
          href={`/pass/${person.id}`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-block text-[16px] font-semibold underline"
          style={{ color: PURPLE }}
        >
          Open their code
        </a>
      </div>

      {/* Never scrolls away: the volunteer's hand is at the bottom of the
          phone and the queue is waiting. */}
      <div
        className="flex-none border-t bg-white px-[18px] pt-3 pb-4"
        style={{ borderColor: HAIRLINE }}
      >
        {inside ? (
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
              onClick={() => onCheckIn(person)}
              className="h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
              style={{ background: PURPLE }}
            >
              Check in {firstName(person)}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2.5 h-[52px] w-full rounded-xl text-[18px] font-semibold"
              style={{ border: `2px solid ${BORDER}`, color: PURPLE }}
            >
              Not them
            </button>
          </>
        )}
      </div>
    </>
  );
}

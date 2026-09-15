"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RosterEntry } from "@convex/checkin";
import { breakoutColour } from "@convex/shared";
import { cn } from "@/components/ui";

/**
 * The registration desk.
 *
 * A laptop with a keyboard is a different instrument from a phone in a queue:
 * somebody sits here for ninety minutes and types surnames. So the search box
 * holds focus permanently and any keystroke lands in it — you never click
 * first — and the three things you need are on screen at once rather than one
 * at a time.
 *
 * Shares every piece of state with the phone screen: same cached roster, same
 * queue, same undo. Only the arrangement differs.
 */

const PURPLE = "#3e2a85";
const BODY = "#4a4460";
const FAINT = "#8d86a3";
const HAIRLINE = "#ece9f3";
const LINE = "#e0dbec";

function at(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

type Group = { label: string; members: RosterEntry[]; inside: number };

export function CheckInDesk({
  people,
  groups,
  arrived,
  isIn,
  onCheckIn,
  onUndo,
  query,
  setQuery,
  results,
  online,
  onScan,
}: {
  people: RosterEntry[];
  groups: Group[];
  arrived: number;
  isIn: (entry: RosterEntry) => boolean;
  onCheckIn: (entries: RosterEntry[]) => void;
  onUndo: (entry: RosterEntry) => void;
  query: string;
  setQuery: (value: string) => void;
  results: RosterEntry[];
  online: boolean;
  onScan: () => void;
}) {
  const [tab, setTab] = useState<"find" | "groups" | "arrived">("find");
  const [openId, setOpenId] = useState<string | null>(null);
  const [partyLabel, setPartyLabel] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Typing anywhere goes to the search box. Nobody at a desk should have to
  // aim at a field before they can start.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target !== null && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (event.key.length === 1 || event.key === "Backspace") {
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const person = useMemo(
    () => people.find((entry) => entry.id === openId) ?? null,
    [people, openId],
  );

  const party = useMemo(
    () => groups.find((group) => group.label === partyLabel) ?? null,
    [groups, partyLabel],
  );

  const feed = useMemo(
    () =>
      people
        .filter(isIn)
        .sort(
          (a, b) => (b.checkedInAt ?? Infinity) - (a.checkedInAt ?? Infinity),
        )
        .slice(0, 12),
    [people, isIn],
  );

  const shown = query.trim().length > 0 ? results : [];
  const waiting = party?.members.filter((entry) => !isIn(entry)) ?? [];

  const openPerson = (id: string) => {
    setPartyLabel(null);
    setOpenId(id);
  };

  return (
    <div className="hidden h-dvh min-w-[870px] grid-cols-[272px_minmax(330px,1fr)_360px] lg:grid">
      {/* ------------------------------------------------- nav and search */}
      <aside
        className="flex min-h-0 flex-col border-r bg-white"
        style={{ borderColor: LINE }}
      >
        <div className="px-5 pt-5 pb-4">
          <p
            className="text-[11.5px] font-semibold tracking-[0.09em] uppercase"
            style={{ color: FAINT }}
          >
            Check-in desk
          </p>
          <p className="mt-1.5 font-display text-[30px] leading-none font-bold text-ink">
            {arrived}
            <span className="ml-2 text-[15px] font-medium" style={{ color: BODY }}>
              of {people.length} in
            </span>
          </p>
        </div>

        <div className="px-4 pb-3">
          <input
            ref={searchRef}
            autoFocus
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTab("find");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results.length === 1) {
                openPerson(results[0].id);
              }
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="Type a surname"
            className="h-12 w-full rounded-xl px-3.5 text-[16px] text-ink"
            style={{ border: `2px solid ${LINE}` }}
          />
        </div>

        <nav className="flex flex-col gap-0.5 px-3 pb-4">
          {(
            [
              ["find", "Find", shown.length],
              ["groups", "Groups", groups.length],
              ["arrived", "Arrived", arrived],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold"
              style={
                tab === key
                  ? { background: "#f5f2fc", color: PURPLE }
                  : { color: BODY }
              }
            >
              {label}
              <span className="text-[13.5px] font-medium" style={{ color: FAINT }}>
                {count}
              </span>
            </button>
          ))}
        </nav>

        <div className="mt-auto">
          {!online && (
            <p
              className="px-5 py-3 text-[14px] font-semibold text-ink"
              style={{ background: "#f5b800" }}
            >
              No internet here. Keep going — nothing is lost.
            </p>
          )}
          <div className="border-t px-4 py-4" style={{ borderColor: HAIRLINE }}>
            <button
              type="button"
              onClick={onScan}
              className="h-11 w-full rounded-xl text-[14.5px] font-semibold"
              style={{ border: `2px solid ${LINE}`, color: PURPLE }}
            >
              Use the camera
            </button>
            <p
              className="mt-3 px-1 text-[13px] leading-relaxed"
              style={{ color: FAINT }}
            >
              Just start typing — the box is always listening. Enter opens the
              only match.
            </p>
          </div>
        </div>
      </aside>

      {/* -------------------------------------------------------- the list */}
      <main
        className="min-h-0 overflow-y-auto border-r"
        style={{ borderColor: LINE, background: "#f4f2f9" }}
      >
        {tab === "groups" ? (
          <ul className="flex flex-col">
            {groups.map((group) => (
              <li key={group.label}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(null);
                    setPicked(new Set());
                    setPartyLabel(group.label);
                  }}
                  className="flex w-full items-center justify-between gap-4 border-b px-5 py-4 text-left hover:bg-white"
                  style={{ borderColor: HAIRLINE }}
                >
                  <span className="min-w-0 truncate text-[16px] font-semibold text-ink">
                    {group.label}
                  </span>
                  <span className="flex-none text-[14px]" style={{ color: BODY }}>
                    {group.inside} of {group.members.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : tab === "arrived" ? (
          <ul className="flex flex-col">
            {feed.length === 0 && (
              <li className="px-5 py-8 text-[15px]" style={{ color: BODY }}>
                Nobody has been checked in yet.
              </li>
            )}
            {people
              .filter(isIn)
              .sort(
                (a, b) =>
                  (b.checkedInAt ?? Infinity) - (a.checkedInAt ?? Infinity),
              )
              .map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => openPerson(entry.id)}
                    className="flex w-full items-center justify-between gap-4 border-b px-5 py-3.5 text-left hover:bg-white"
                    style={{ borderColor: HAIRLINE }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-semibold text-ink">
                        {entry.name}
                      </span>
                      <span className="block text-[13.5px]" style={{ color: BODY }}>
                        {entry.group.length > 0 ? entry.group : entry.registrationNumber}
                      </span>
                    </span>
                    <span className="flex-none text-[13.5px]" style={{ color: FAINT }}>
                      {entry.checkedInAt !== null ? at(entry.checkedInAt) : "now"}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        ) : shown.length === 0 ? (
          <p className="px-5 py-8 text-[15px] leading-relaxed" style={{ color: BODY }}>
            {query.trim().length === 0
              ? "Type a surname on the left. Matches appear here."
              : "Nobody by that name. Try the surname on its own, or their group."}
          </p>
        ) : (
          <ul className="flex flex-col">
            {shown.map((entry) => {
              const inside = isIn(entry);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => openPerson(entry.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-4 border-b px-5 py-3.5 text-left hover:bg-white",
                      openId === entry.id && "bg-white",
                    )}
                    style={{ borderColor: HAIRLINE }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-semibold text-ink">
                        {entry.name}
                      </span>
                      <span className="block truncate text-[13.5px]" style={{ color: BODY }}>
                        {entry.group.length > 0
                          ? entry.group
                          : entry.church.length > 0
                            ? entry.church
                            : entry.registrationNumber}
                      </span>
                    </span>
                    {inside && (
                      <span
                        className="flex-none rounded-md px-2.5 py-1 text-[12.5px] font-semibold"
                        style={{ background: "#e8f4f8", color: "#1d5f78" }}
                      >
                        In
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* ------------------------------------------------- person and feed */}
      <section className="flex min-h-0 flex-col bg-white">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-4">
          {party !== null ? (
            <GroupPanel
              party={party}
              waiting={waiting}
              picked={picked}
              setPicked={setPicked}
              onCheckIn={(entries) => {
                onCheckIn(entries);
                setPicked(new Set());
                setPartyLabel(null);
              }}
            />
          ) : person === null ? (
            <p className="text-[16px] leading-relaxed" style={{ color: BODY }}>
              Their name and session appear here. You do not have to click the
              box first — just type.
            </p>
          ) : (
            <PersonPanel
              person={person}
              people={people}
              isIn={isIn}
              onCheckIn={onCheckIn}
              onUndo={onUndo}
              onOpen={openPerson}
            />
          )}
        </div>

        <div className="flex-none border-t px-6 py-4" style={{ borderColor: HAIRLINE }}>
          <p
            className="text-[11.5px] font-semibold tracking-[0.09em] uppercase"
            style={{ color: FAINT }}
          >
            Last few in
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {feed.slice(0, 5).map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-3 text-[14px]"
              >
                <span className="min-w-0 truncate text-ink">{entry.name}</span>
                <span className="flex-none" style={{ color: FAINT }}>
                  {entry.checkedInAt !== null ? at(entry.checkedInAt) : "now"}
                </span>
              </li>
            ))}
            {feed.length === 0 && (
              <li className="text-[14px]" style={{ color: FAINT }}>
                Nobody yet.
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function PersonPanel({
  person,
  people,
  isIn,
  onCheckIn,
  onUndo,
  onOpen,
}: {
  person: RosterEntry;
  people: RosterEntry[];
  isIn: (entry: RosterEntry) => boolean;
  onCheckIn: (entries: RosterEntry[]) => void;
  onUndo: (entry: RosterEntry) => void;
  onOpen: (id: string) => void;
}) {
  const inside = isIn(person);
  const colour = breakoutColour(person.sessionNumber);
  const family = people.filter(
    (entry) =>
      entry.registrationNumber === person.registrationNumber &&
      entry.id !== person.id,
  );

  const field = (label: string, value: string) =>
    value.trim().length === 0 ? null : (
      <div className="min-w-0">
        <dt className="text-[12.5px]" style={{ color: FAINT }}>
          {label}
        </dt>
        <dd className="truncate text-[14.5px] text-ink">{value}</dd>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <div>
        {inside && (
          <span
            className="inline-block rounded-md px-2.5 py-1.5 text-[13px] font-semibold"
            style={{ background: "#e8f4f8", color: "#1d5f78" }}
          >
            Here since{" "}
            {person.checkedInAt !== null ? at(person.checkedInAt) : "just now"}
          </span>
        )}
        <p className="mt-2 font-display text-[26px] leading-[1.15] font-bold text-ink">
          {person.name}
        </p>
      </div>

      {/* The line that gets said out loud. The rooms are signed by colour, so
          that is what leads — the title is for the one person who asks. */}
      <div
        className="rounded-xl px-3.5 py-3"
        style={{ background: colour?.tint ?? "#f5f2fc" }}
      >
        <p
          className="text-[13px] font-semibold"
          style={{ color: colour?.ink ?? PURPLE }}
        >
          Send them to
        </p>
        {colour !== null && (
          <p className="mt-1.5 flex items-center gap-2">
            <span
              className="size-5 flex-none rounded-full"
              style={{
                background: colour.hex,
                border: `2px solid ${colour.ink}`,
              }}
            />
            <span
              className="font-display text-[21px] leading-none font-bold"
              style={{ color: colour.ink }}
            >
              {colour.name} room
            </span>
          </p>
        )}
        <p
          className="mt-1.5 text-[14.5px] leading-[1.3] font-semibold"
          style={{ color: colour?.ink ?? "#191528" }}
        >
          {person.session}
        </p>
      </div>

      {!person.cleared && (
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: "#fff6dd", border: "2px solid #f0d68a" }}
        >
          <p className="text-[14.5px] font-semibold" style={{ color: "#7a5c00" }}>
            Payment not finished
          </p>
          <p className="mt-0.5 text-[13.5px]" style={{ color: "#6b5200" }}>
            Let them in. Nothing to collect here.
          </p>
        </div>
      )}

      {inside ? (
        <button
          type="button"
          onClick={() => onUndo(person)}
          className="h-14 w-full rounded-xl text-[16px] font-semibold"
          style={{ border: `2px solid ${LINE}`, color: BODY }}
        >
          Undo — not here
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onCheckIn([person])}
          className="h-14 w-full rounded-xl text-[17px] font-semibold text-white"
          style={{ background: PURPLE }}
        >
          Check in{" "}
          {person.goesBy.trim().length > 0
            ? person.goesBy.trim()
            : person.name.split(" ")[0].replace(/,$/, "")}
        </button>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {field("Goes by", person.goesBy)}
        {field("Mobile", person.mobile)}
        {field("Church", person.church)}
        {field("Email", person.email)}
        {field("City", person.city)}
        {field("Number", person.registrationNumber)}
        {field("Group", person.group)}
        {field("Paid", person.cleared ? "Settled" : "Not finished")}
      </dl>

      {family.length > 0 && (
        <div className="border-t pt-4" style={{ borderColor: HAIRLINE }}>
          <p
            className="text-[11.5px] font-semibold tracking-[0.09em] uppercase"
            style={{ color: FAINT }}
          >
            {family.length} more with them
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {family.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => onOpen(entry.id)}
                  className="min-w-0 flex-1 truncate text-left text-[14.5px] text-ink hover:underline"
                >
                  {entry.name}
                </button>
                {isIn(entry) ? (
                  <span className="flex-none text-[13px]" style={{ color: FAINT }}>
                    In
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCheckIn([entry])}
                    className="flex-none rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-white"
                    style={{ background: PURPLE }}
                  >
                    Check in
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <a
        href={`/pass/${person.id}`}
        target="_blank"
        rel="noreferrer"
        className="text-[14px] font-semibold underline"
        style={{ color: PURPLE }}
      >
        Open their code
      </a>
    </div>
  );
}

function GroupPanel({
  party,
  waiting,
  picked,
  setPicked,
  onCheckIn,
}: {
  party: Group;
  waiting: RosterEntry[];
  picked: Set<string>;
  setPicked: (next: Set<string>) => void;
  onCheckIn: (entries: RosterEntry[]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-display text-[22px] leading-[1.2] font-bold text-ink">
          {party.label}
        </p>
        <p className="mt-1 text-[14.5px]" style={{ color: BODY }}>
          {party.inside} of {party.members.length} already here. Tick who is
          standing there.
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {waiting.map((entry) => {
          const on = picked.has(entry.id);
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => {
                  const next = new Set(picked);
                  if (next.has(entry.id)) next.delete(entry.id);
                  else next.add(entry.id);
                  setPicked(next);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                style={
                  on
                    ? { background: "#f5f2fc", border: `2px solid ${PURPLE}` }
                    : { border: `2px solid ${LINE}` }
                }
              >
                <span
                  className="flex size-5 flex-none items-center justify-center rounded text-[13px] font-bold"
                  style={
                    on
                      ? { background: PURPLE, color: "#fff" }
                      : { border: `2px solid ${LINE}`, color: "transparent" }
                  }
                >
                  ✓
                </span>
                <span className="truncate text-[15px] font-medium text-ink">
                  {entry.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={picked.size === 0}
        onClick={() =>
          onCheckIn(waiting.filter((entry) => picked.has(entry.id)))
        }
        className="h-14 w-full rounded-xl text-[17px] font-semibold text-white disabled:opacity-40"
        style={{ background: PURPLE }}
      >
        Check in {picked.size === 0 ? "" : picked.size}
      </button>
    </div>
  );
}

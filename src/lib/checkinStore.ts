/**
 * The device's own copy of the door.
 *
 * Everything here assumes the network is gone. The roster is written to
 * localStorage the moment it arrives, and every check-in is written to a queue
 * before anything is sent. A phone that loses signal mid-queue keeps working;
 * a phone that is closed and reopened still has both.
 *
 * localStorage rather than IndexedDB deliberately: the payload is a few hundred
 * kilobytes, it is written rarely and read constantly, and synchronous reads
 * mean the list is on screen before the first paint rather than after it.
 */

import type { RosterEntry } from "@convex/checkin";

const ROSTER_KEY = "crossgen.checkin.roster.v1";
const QUEUE_KEY = "crossgen.checkin.queue.v1";
const NAMES_KEY = "crossgen.checkin.names.v1";

export type CachedRoster = { at: number; people: RosterEntry[] };
export type QueuedCheckIn = { participantId: string; at: number };
export type QueuedName = {
  participantId: string;
  name: string;
  /** What the door said they were, for whoever sorts it out afterwards. */
  note: string;
  at: number;
};

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    // A corrupted or full store must not take the door down.
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Out of quota, or private mode. The screen keeps working from memory.
  }
}

export function loadRoster(): CachedRoster | null {
  return read<CachedRoster>(ROSTER_KEY);
}

export function saveRoster(roster: CachedRoster): void {
  write(ROSTER_KEY, roster);
}

export function loadQueue(): QueuedCheckIn[] {
  return read<QueuedCheckIn[]>(QUEUE_KEY) ?? [];
}

export function saveQueue(queue: QueuedCheckIn[]): void {
  write(QUEUE_KEY, queue);
}

/** Adds to the queue unless that person is already waiting in it. */
export function enqueue(participantId: string): QueuedCheckIn[] {
  const queue = loadQueue();
  if (queue.some((entry) => entry.participantId === participantId)) return queue;
  const next = [...queue, { participantId, at: Date.now() }];
  saveQueue(next);
  return next;
}

/**
 * Names typed into sponsor seats, waiting to be sent.
 *
 * A second queue rather than a field on the first: a seat is checked in the
 * moment somebody stands there, and the name is a separate promise the device
 * makes. Either can be waiting without the other, and losing the name must
 * never cost us the arrival.
 */
export function loadNames(): QueuedName[] {
  return read<QueuedName[]>(NAMES_KEY) ?? [];
}

/** Writes a name into a seat locally, replacing any earlier one. */
export function queueName(
  participantId: string,
  name: string,
  note = "",
): QueuedName[] {
  const next = [
    ...loadNames().filter((entry) => entry.participantId !== participantId),
    { participantId, name: name.trim(), note: note.trim(), at: Date.now() },
  ];
  write(NAMES_KEY, next);
  return next;
}

/** Drops the names that made it to the server, keeping any typed since. */
export function clearNames(sent: QueuedName[]): QueuedName[] {
  const done = new Map(sent.map((entry) => [entry.participantId, entry.name]));
  const next = loadNames().filter(
    (entry) => done.get(entry.participantId) !== entry.name,
  );
  write(NAMES_KEY, next);
  return next;
}

/** Drops the entries that made it to the server, keeping any added since. */
export function clearQueued(sent: QueuedCheckIn[]): QueuedCheckIn[] {
  const done = new Set(sent.map((entry) => entry.participantId));
  const next = loadQueue().filter((entry) => !done.has(entry.participantId));
  saveQueue(next);
  return next;
}

/**
 * Ranks people against what has been typed.
 *
 * Surname first, because that is how a door queue identifies itself and how
 * the printed fallback is sorted. A match on the start of any word beats a
 * match in the middle, so typing "sil" puts Silvestre above Basilio.
 */
export function searchRoster(
  people: RosterEntry[],
  query: string,
  limit = 25,
): RosterEntry[] {
  const needle = query.toLowerCase().trim();
  if (needle.length === 0) return [];

  const scored: { entry: RosterEntry; score: number }[] = [];
  for (const entry of people) {
    const at = entry.search.indexOf(needle);
    if (at === -1) continue;
    const startsWord = at === 0 || entry.search[at - 1] === " ";
    // Surname hits rank above given-name hits, which rank above group hits.
    const inName = at < entry.name.length;
    scored.push({
      entry,
      score: (startsWord ? 0 : 2) + (inName ? 0 : 1),
    });
  }

  return scored
    .sort(
      (a, b) =>
        a.score - b.score || a.entry.name.localeCompare(b.entry.name),
    )
    .slice(0, limit)
    .map((row) => row.entry);
}

/**
 * A scanned code resolved to somebody on the roster.
 *
 * Codes carry a participant id, but people also arrive showing the
 * registration number from their confirmation email, so both are accepted.
 */
export function resolveScan(
  people: RosterEntry[],
  raw: string,
): RosterEntry[] {
  const text = raw.trim();
  if (text.length === 0) return [];

  const exact = people.find((entry) => entry.id === text);
  if (exact !== undefined) return [exact];

  // A URL with the id on the end, which is what a QR usually holds.
  const tail = text.split("/").pop() ?? "";
  const byTail = people.find((entry) => entry.id === tail);
  if (byTail !== undefined) return [byTail];

  const number = text.toUpperCase();
  const group = people.filter(
    (entry) => entry.registrationNumber.toUpperCase() === number,
  );
  return group;
}

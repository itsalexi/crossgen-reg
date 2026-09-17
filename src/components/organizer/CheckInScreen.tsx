"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import jsQR from "jsqr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { RosterEntry } from "@convex/checkin";
import { breakoutRoom } from "@convex/shared";
import { cn } from "@/components/ui";
import { CheckInDesk } from "@/components/organizer/CheckInDesk";
import { ScanSheet } from "@/components/organizer/ScanSheet";
import { SponsorSheet } from "@/components/organizer/SponsorSheet";
import {
  clearNames,
  clearQueued,
  enqueue,
  loadNames,
  loadQueue,
  queueName,
  loadRoster,
  resolveScan,
  saveRoster,
  searchRoster,
  type CachedRoster,
  type QueuedCheckIn,
  type QueuedName,
} from "@/lib/checkinStore";

/**
 * The door.
 *
 * Built for a volunteer holding a phone one-handed in a bright hall with a
 * queue in front of them: one question per screen, plain words, nothing under
 * 16px, every button big enough to hit without looking. Deliberately says
 * nothing about syncing, caches or queues — the phone handles that silently
 * and the only promise made is "nothing is lost".
 *
 * Reads from the device's own copy of the roster, never the live query, so it
 * behaves identically with or without a connection.
 */

const HEADER = "#291a5c";
const PURPLE = "#3e2a85";
const GOLD = "#f5b800";
const BORDER = "#c9c2dd";
const HAIRLINE = "#ddd8e8";
const BODY = "#4a4460";

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
    // The screen carries it.
  }
}

type View =
  | { kind: "find" }
  | { kind: "scan" }
  | { kind: "person"; id: string }
  | { kind: "sponsor"; number: string }
  | { kind: "groupCount"; label: string }
  | { kind: "groupPick"; label: string; expected: number }
  | { kind: "groupDone"; label: string; names: RosterEntry[] };

type ScanState =
  { kind: "waiting" } | { kind: "nocamera" } | { kind: "unreadable" };

/**
 * A read code, and how far along it is in arriving on screen.
 *
 * The camera does not hand over to another screen. It freezes, the box closes
 * on the code, and the same confirmation the manual flow uses rises over the
 * held frame — so the volunteer keeps their place, and a read that was wrong
 * can be dismissed straight back into the queue.
 */
type Hit = {
  stage: "locking" | "open" | "closing";
} & ({ kind: "person"; id: string } | { kind: "sponsor"; number: string });

export function CheckInScreen() {
  const { isAuthenticated } = useConvexAuth();
  const live = useQuery(api.checkin.roster, isAuthenticated ? {} : "skip");
  const send = useMutation(api.checkin.checkIn);
  const undo = useMutation(api.checkin.undoCheckIn);
  const claim = useMutation(api.sponsors.claimSeat);

  const [cache, setCache] = useState<CachedRoster | null>(null);
  const [queue, setQueue] = useState<QueuedCheckIn[]>([]);
  const [names, setNames] = useState<QueuedName[]>([]);
  const [view, setView] = useState<View>({ kind: "find" });
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [scan, setScan] = useState<ScanState>({ kind: "waiting" });
  const [starting, setStarting] = useState(false);
  const [hit, setHit] = useState<Hit | null>(null);
  /** False for a moment after a card closes, while the last code clears. */
  const [ready, setReady] = useState(true);
  const stageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Nothing is read before this time.
   *
   * The person who was just dealt with is still standing there with their
   * phone up. Without a pause after the card closes, their code is read again
   * before the volunteer has looked up, and the card they just dismissed comes
   * straight back.
   */
  const coolUntil = useRef(0);
  /**
   * The roster, reachable from inside the camera loop without being a
   * dependency of it.
   *
   * Checking somebody in changes the queue, which changed the roster's
   * identity, which tore the camera down and built it again mid-queue: a
   * visible flash, and every guard against re-reading the code still in frame
   * reset along with it, so the card that was just dismissed came straight
   * back. The camera now starts once and stops when the screen is left.
   */
  const peopleRef = useRef<RosterEntry[]>([]);
  const [torch, setTorch] = useState<{ on: boolean; available: boolean }>({
    on: false,
    available: false,
  });
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastScan = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  /**
   * Stops the camera reading while a result is on screen.
   *
   * Without this the same code sits in frame and is read again a few seconds
   * later — by which time the person is checked in, so the screen flips itself
   * to "already here" with nobody having done anything.
   */
  const paused = useRef(false);

  useEffect(() => {
    setCache(loadRoster());
    setQueue(loadQueue());
    setNames(loadNames());
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (live === undefined) return;
    saveRoster(live);
    setCache(live);
  }, [live]);

  const flush = useCallback(async () => {
    const waiting = loadQueue();
    if (waiting.length === 0 || !navigator.onLine) return;
    try {
      await send({
        entries: waiting.map((entry) => ({
          participantId: entry.participantId as Id<"participants">,
          at: entry.at,
          queued: true,
        })),
      });
    } catch {
      // Stays queued for the next attempt.
    }
  }, [send]);

  /**
   * Sends the names typed into sponsor seats.
   *
   * One at a time and stopping at the first failure: they are independent
   * writes, and there is no sense retrying the rest of the list against a
   * network that just refused.
   */
  const flushNames = useCallback(async () => {
    const waiting = loadNames();
    if (waiting.length === 0 || !navigator.onLine) return;
    for (const entry of waiting) {
      try {
        await claim({
          participantId: entry.participantId as Id<"participants">,
          name: entry.name,
        });
      } catch {
        return;
      }
    }
  }, [claim]);

  useEffect(() => {
    void flush();
    void flushNames();
    const timer = setInterval(() => {
      void flush();
      void flushNames();
    }, 15000);
    const again = () => {
      void flush();
      void flushNames();
    };
    window.addEventListener("online", again);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", again);
    };
  }, [flush, flushNames]);

  /**
   * The roster, with any name typed into a sponsor seat already written in.
   *
   * The seat is claimed the moment the volunteer taps, not when the network
   * agrees. Without the overlay a phone with no signal shows the name it just
   * took as an empty seat again, which reads as having lost it.
   */
  const people = useMemo(() => {
    const base = cache?.people ?? [];
    if (names.length === 0) return base;
    const typed = new Map(names.map((entry) => [entry.participantId, entry.name]));
    return base.map((entry) => {
      const name = typed.get(entry.id);
      if (name === undefined || name === entry.name) return entry;
      return { ...entry, name, search: `${name} ${entry.search}`.toLowerCase() };
    });
  }, [cache, names]);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  /**
   * Drops a queued check-in only once the roster comes back showing that
   * person inside.
   *
   * Clearing it the moment the write returned left a gap: for as long as the
   * roster took to catch up, the device believed nobody had checked them in,
   * and a card on screen flipped back to "not checked in yet" and then
   * forward again. Re-sending one that is already recorded costs nothing —
   * the mutation keeps the earliest arrival and adds nothing.
   */
  useEffect(() => {
    const confirmed = queue.filter((entry) =>
      people.some(
        (person) =>
          person.id === entry.participantId && person.checkedInAt !== null,
      ),
    );
    if (confirmed.length > 0) setQueue(clearQueued(confirmed));
  }, [people, queue]);

  // Same bargain for the names: kept until the roster itself says so.
  useEffect(() => {
    const landed = names.filter((entry) =>
      (cache?.people ?? []).some(
        (person) =>
          person.id === entry.participantId &&
          person.name.trim() === entry.name.trim(),
      ),
    );
    if (landed.length > 0) setNames(clearNames(landed));
  }, [cache, names]);

  const queued = useMemo(
    () => new Set(queue.map((entry) => entry.participantId)),
    [queue],
  );
  const isIn = useCallback(
    (entry: RosterEntry) => entry.checkedInAt !== null || queued.has(entry.id),
    [queued],
  );
  const arrived = useMemo(() => people.filter(isIn).length, [people, isIn]);

  const markIn = useCallback(
    (entries: RosterEntry[]) => {
      const fresh = entries.filter((entry) => !isIn(entry));
      if (fresh.length === 0) return;
      let next = queue;
      for (const entry of fresh) next = enqueue(entry.id);
      setQueue(next);
      buzz(fresh.length > 1 ? [18, 60, 18] : 18);
      void flush();
    },
    [flush, isIn, queue],
  );

  /**
   * Writes the name into the seat and marks it arrived.
   *
   * In that order on the device, and independently on the wire: the arrival is
   * the fact the day turns on, the name is a detail that can follow when there
   * is signal for it.
   */
  const claimSeat = useCallback(
    (seat: RosterEntry, name: string) => {
      const typed = name.trim();
      if (typed.length > 0) setNames(queueName(seat.id, typed));
      markIn([seat]);
      void flushNames();
    },
    [flushNames, markIn],
  );

  const undoOne = useCallback(
    (entry: RosterEntry) => {
      setQueue(clearQueued([{ participantId: entry.id, at: 0 }]));
      if (navigator.onLine) {
        void undo({ participantId: entry.id as Id<"participants"> });
      }
    },
    [undo],
  );

  /** Undo on a seat gives the seat back as well as the arrival. */
  const releaseSeat = useCallback(
    (seat: RosterEntry) => {
      undoOne(seat);
      if (seat.name.trim().length > 0) {
        setNames(queueName(seat.id, ""));
        void flushNames();
      }
    },
    [flushNames, undoOne],
  );

  const results = useMemo(() => searchRoster(people, query), [people, query]);

  const groups = useMemo(() => {
    const byName = new Map<string, RosterEntry[]>();
    for (const entry of people) {
      const key = entry.group.trim();
      if (key.length === 0) continue;
      byName.set(key, [...(byName.get(key) ?? []), entry]);
    }
    return [...byName.entries()]
      .map(([label, members]) => ({
        label,
        members,
        inside: members.filter(isIn).length,
      }))
      .filter((group) => group.members.length >= 4)
      .sort(
        (a, b) =>
          a.members.length - a.inside - (b.members.length - b.inside) ||
          b.members.length - a.members.length,
      )
      .reverse();
  }, [people, isIn]);

  const groupFor = useCallback(
    (label: string) => groups.find((group) => group.label === label) ?? null,
    [groups],
  );

  const person = useMemo(
    () =>
      view.kind === "person"
        ? (people.find((entry) => entry.id === view.id) ?? null)
        : null,
    [view, people],
  );

  const hitPerson = useMemo(
    () =>
      hit === null || hit.kind !== "person"
        ? null
        : (people.find((entry) => entry.id === hit.id) ?? null),
    [hit, people],
  );

  /** Seats belonging to one sponsor, in the order they were created. */
  const seatsOf = useCallback(
    (registrationNumber: string) =>
      people.filter(
        (entry) => entry.seat && entry.registrationNumber === registrationNumber,
      ),
    [people],
  );

  /**
   * Sponsors with seats, for the door to reach without a camera. The manual
   * way in: the code is a convenience, not the only route.
   */
  const pools = useMemo(() => {
    const byNumber = new Map<string, RosterEntry[]>();
    for (const entry of people) {
      if (!entry.seat) continue;
      byNumber.set(entry.registrationNumber, [
        ...(byNumber.get(entry.registrationNumber) ?? []),
        entry,
      ]);
    }
    return [...byNumber.entries()]
      .map(([number, seats]) => ({
        number,
        org: seats[0].group.length > 0 ? seats[0].group : seats[0].church,
        seats,
        used: seats.filter(
          (seat) => isIn(seat) || seat.name.trim().length > 0,
        ).length,
      }))
      .sort((a, b) => a.org.localeCompare(b.org));
  }, [people, isIn]);

  // ------------------------------------------------------------- scanning

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current !== null) videoRef.current.srcObject = null;
    trackRef.current = null;
    setTorch({ on: false, available: false });
  }, []);

  useEffect(() => {
    if (view.kind !== "scan") {
      stopCamera();
      return;
    }
    let alive = true;
    paused.current = false;
    lastScan.current = { value: "", at: 0 };
    setScan({ kind: "waiting" });
    setHit(null);
    setReady(true);
    coolUntil.current = 0;

    const handle = (value: string) => {
      // The camera reads the same code many times a second, and the last
      // person is still in front of the lens for a few seconds after that.
      if (Date.now() < coolUntil.current) return;
      const repeat =
        value === lastScan.current.value &&
        Date.now() - lastScan.current.at < 8000;
      if (repeat) return;
      lastScan.current = { value, at: Date.now() };

      const matches = resolveScan(peopleRef.current, value);

      // A sponsor's code points at seats rather than at anybody: every match
      // is a seat on the same registration, and the card asks for a name.
      if (matches.length > 0 && matches.every((entry) => entry.seat)) {
        const number = matches[0].registrationNumber;
        paused.current = true;
        buzz(12);
        videoRef.current?.pause();
        setHit({ kind: "sponsor", number, stage: "locking" });
        if (stageTimer.current !== null) clearTimeout(stageTimer.current);
        stageTimer.current = setTimeout(
          () => setHit({ kind: "sponsor", number, stage: "open" }),
          240,
        );
        return;
      }

      if (matches.length === 1) {
        const entry = matches[0];
        // Read, but not acted on: a code drifting through the frame must not
        // mark anybody present. The frame is held so it is obvious which phone
        // was read, and the card follows a beat later instead of replacing
        // everything the instant the code lands.
        paused.current = true;
        buzz(12);
        videoRef.current?.pause();
        setHit({ kind: "person", id: entry.id, stage: "locking" });
        if (stageTimer.current !== null) clearTimeout(stageTimer.current);
        stageTimer.current = setTimeout(
          () => setHit({ kind: "person", id: entry.id, stage: "open" }),
          240,
        );
      } else if (matches.length > 1) {
        setQuery(matches[0].registrationNumber);
        setView({ kind: "find" });
      } else {
        paused.current = true;
        buzz([10, 40, 10, 40, 10]);
        setScan({ kind: "unreadable" });
      }
    };

    const run = async () => {
      let stream: MediaStream;
      setStarting(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setStarting(false);
        // Permission refused, or no camera. Not the same as a bad code, and
        // telling a volunteer to "ask for their surname" is right either way.
        setScan({ kind: "nocamera" });
        return;
      }
      if (!alive) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const track = stream.getVideoTracks()[0] ?? null;
      trackRef.current = track;
      const capabilities = track?.getCapabilities?.() as
        { torch?: boolean } | undefined;
      setTorch({ on: false, available: capabilities?.torch === true });
      setStarting(false);
      if (videoRef.current !== null) {
        videoRef.current.srcObject = stream;
        // iOS will not start a stream without this, and silently shows black.
        videoRef.current.setAttribute("playsinline", "true");
        try {
          await videoRef.current.play();
        } catch {
          // Autoplay refused; the frames below simply never arrive.
        }
      }

      // Chrome and Edge on Android decode in the browser. Everything on iOS is
      // WebKit underneath — Chrome for iPhone included — and WebKit has no
      // BarcodeDetector, so those fall back to decoding frames ourselves.
      const Detector = (
        window as unknown as { BarcodeDetector?: new (o: unknown) => unknown }
      ).BarcodeDetector;

      // Both paths read the same centred square rather than the whole frame.
      // That is what makes the box on screen mean something: a second code in
      // the queue behind cannot be read by accident, and on a phone doing the
      // decoding in JavaScript it is roughly four times less work per frame.
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) {
        setScan({ kind: "nocamera" });
        return;
      }
      const SIDE = 420;
      canvas.width = SIDE;
      canvas.height = SIDE;

      const drawBox = (): boolean => {
        const video = videoRef.current;
        if (video === null || video.readyState < video.HAVE_CURRENT_DATA) {
          return false;
        }
        const side = Math.min(video.videoWidth, video.videoHeight) * 0.72;
        if (!Number.isFinite(side) || side <= 0) return false;
        context.drawImage(
          video,
          (video.videoWidth - side) / 2,
          (video.videoHeight - side) / 2,
          side,
          side,
          0,
          0,
          SIDE,
          SIDE,
        );
        return true;
      };

      if (Detector !== undefined) {
        const detector = new Detector({ formats: ["qr_code"] }) as {
          detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>;
        };
        const tick = async () => {
          if (!alive || videoRef.current?.srcObject == null) return;
          if (!paused.current && drawBox()) {
            try {
              const found = await detector.detect(canvas);
              if (found[0]?.rawValue !== undefined) handle(found[0].rawValue);
            } catch {
              // A blurred frame is normal.
            }
          }
          if (alive) requestAnimationFrame(() => void tick());
        };
        void tick();
        return;
      }

      const tick = () => {
        if (!alive || videoRef.current === null) return;
        if (!paused.current && drawBox()) {
          const image = context.getImageData(0, 0, SIDE, SIDE);
          const found = jsQR(image.data, SIDE, SIDE, {
            inversionAttempts: "dontInvert",
          });
          if (found !== null && found.data.length > 0) handle(found.data);
        }
        if (alive) setTimeout(tick, 100);
      };
      tick();
    };

    void run();
    return () => {
      alive = false;
      if (stageTimer.current !== null) clearTimeout(stageTimer.current);
      if (readyTimer.current !== null) clearTimeout(readyTimer.current);
      stopCamera();
    };
  }, [view.kind, stopCamera]);

  // ------------------------------------------------------------------ ui

  const back = () => {
    setPicked(new Set());
    setView({ kind: "find" });
  };

  /**
   * Puts the card away and starts the camera reading again.
   *
   * Deliberately the same exit for every way out of the card — done, undone, or
   * the wrong person entirely. The queue does not stop moving while somebody
   * decides which button meant "carry on".
   */
  const closeHit = useCallback(() => {
    if (stageTimer.current !== null) clearTimeout(stageTimer.current);
    if (readyTimer.current !== null) clearTimeout(readyTimer.current);
    setHit((current) =>
      current === null ? null : { ...current, stage: "closing" },
    );
    setReady(false);
    stageTimer.current = setTimeout(() => {
      setHit(null);
      paused.current = false;
      // Deliberately not clearing lastScan: the code that was just handled is
      // still in frame, and it is the one thing that must not be read again.
      coolUntil.current = Date.now() + 1800;
      void videoRef.current?.play().catch(() => {});
      readyTimer.current = setTimeout(() => setReady(true), 1800);
    }, 200);
  }, []);

  /**
   * The phone's lamp. A church hall at 8am is darker than anyone expects and a
   * phone screen held under a shadow is the usual reason a code will not read.
   */
  const toggleTorch = useCallback(() => {
    const track = trackRef.current;
    if (track === null) return;
    const next = !torch.on;
    void track
      .applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      })
      .then(() => setTorch((current) => ({ ...current, on: next })))
      .catch(() => setTorch((current) => ({ ...current, available: false })));
  }, [torch.on]);

  /** Clears the result and starts looking again. */
  const nextPerson = () => {
    paused.current = false;
    lastScan.current = { value: "", at: 0 };
    setScan({ kind: "waiting" });
  };
  const onHome = view.kind === "find" || view.kind === "scan";

  if (cache === null) {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <Bar arrived={0} />
        <div className="flex flex-1 flex-col gap-6 px-5 pt-8 pb-6">
          <p className="font-display text-[32px] leading-[1.15] font-bold tracking-[-0.025em] text-balance text-ink">
            Getting today&rsquo;s list
          </p>
          <p
            className="text-[19px] leading-relaxed text-pretty"
            style={{ color: BODY }}
          >
            This phone does not have the names yet. Stay on this screen until
            they appear — it takes a few seconds.
          </p>
          <p className="text-[17px] leading-relaxed text-[#6e6885]">
            Do it now, before the queue starts. Once loaded, this phone keeps
            working even with no internet.
          </p>
          <div
            className="mt-auto border-t pt-5"
            style={{ borderColor: HAIRLINE }}
          >
            <p className="text-[18px] font-semibold text-ink">
              Nothing appearing?
            </p>
            <p
              className="mt-2 text-[17px] leading-relaxed"
              style={{ color: BODY }}
            >
              Stand closer to the front desk, or ask for a phone that is already
              set up.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const FindPane = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none bg-white px-3.5 pt-3 pb-3">
        <input
          ref={searchRef}
          autoFocus
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Surname, or their group"
          className="h-[68px] w-full rounded-xl px-4 text-[19px] text-ink"
          style={{ border: `2px solid ${BORDER}`, background: "#fff" }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-1 pb-3">
        {query.trim().length === 0 ? (
          <>
            {pools.length > 0 && (
              <>
                {/* The camera is a shortcut, not the only door. A sponsor's
                    seats are reachable here whether or not anybody brought
                    the code, or the camera opens at all. */}
                <p
                  className="px-1 py-2.5 text-[16px] leading-none font-semibold"
                  style={{ color: BODY }}
                >
                  Sponsor seats
                </p>
                <ul className="mb-4 flex flex-col gap-2.5">
                  {pools.map((pool) => (
                    <li key={pool.number}>
                      <button
                        type="button"
                        onClick={() =>
                          setView({ kind: "sponsor", number: pool.number })
                        }
                        className="flex min-h-[72px] w-full items-center justify-between gap-3.5 rounded-2xl bg-white px-[18px] py-4 text-left"
                        style={{ border: `2px solid ${HAIRLINE}` }}
                      >
                        <span className="text-[19px] leading-[1.25] font-semibold text-ink">
                          {pool.org}
                        </span>
                        <span
                          className="flex-none text-[17px] leading-[1.2] font-medium"
                          style={{ color: BODY }}
                        >
                          {pool.used} of {pool.seats.length}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p
              className="px-1 py-2.5 text-[16px] leading-none font-semibold"
              style={{ color: BODY }}
            >
              Groups on their way
            </p>
            <ul className="flex flex-col gap-2.5">
              {groups.map((group) => (
                <li key={group.label}>
                  <button
                    type="button"
                    onClick={() =>
                      setView({ kind: "groupCount", label: group.label })
                    }
                    className="flex min-h-[72px] w-full items-center justify-between gap-3.5 rounded-2xl bg-white px-[18px] py-4 text-left"
                    style={{ border: `2px solid ${HAIRLINE}` }}
                  >
                    <span className="text-[19px] leading-[1.25] font-semibold text-ink">
                      {group.label}
                    </span>
                    <span
                      className="flex-none text-[17px] leading-[1.2] font-medium"
                      style={{ color: BODY }}
                    >
                      {group.inside} of {group.members.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : results.length === 0 ? (
          <div className="px-1 pt-6">
            <p className="font-display text-[27px] leading-[1.15] font-bold text-ink">
              Nobody by that name
            </p>
            <p
              className="mt-2 text-[18px] leading-[1.45]"
              style={{ color: BODY }}
            >
              Ask them to spell the surname, or type the church or group they
              came with.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              className="mt-5 h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
              style={{ background: PURPLE }}
            >
              Try again
            </button>
            <p className="mt-5 text-[17px] leading-[1.45] text-[#6e6885]">
              Still nothing? Walk them to the registration table. They can be
              added there.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {results.map((entry) => {
              const inside = isIn(entry);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setView({ kind: "person", id: entry.id })}
                    className="flex min-h-[80px] w-full items-center justify-between gap-3.5 rounded-2xl bg-white px-[18px] py-4 text-left"
                    style={{ border: `2px solid ${HAIRLINE}` }}
                  >
                    <span className="min-w-0">
                      <span className="block text-[19px] leading-[1.25] font-semibold text-ink">
                        {entry.name}
                      </span>
                      <span
                        className="block text-[16px] leading-[1.35]"
                        style={{ color: BODY }}
                      >
                        {entry.group.length > 0
                          ? entry.group
                          : entry.church.length > 0
                            ? entry.church
                            : entry.registrationNumber}
                      </span>
                    </span>
                    <span
                      className="flex-none rounded-xl px-4 py-3 text-[17px] font-semibold"
                      style={
                        inside
                          ? { background: "#e8f4f8", color: "#1d5f78" }
                          : { background: PURPLE, color: "#fff" }
                      }
                    >
                      {inside ? "Already here" : "Open"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* The registration desk is a different job from the door. Somebody sits
          there with a keyboard for ninety minutes, so it gets its own layout:
          search, list and person side by side, in CheckInDesk. The camera is
          the one screen both share, and it stays full width on either. */}
      {view.kind !== "scan" && (
        <CheckInDesk
          people={people}
          groups={groups}
          arrived={arrived}
          isIn={isIn}
          onCheckIn={markIn}
          onUndo={undoOne}
          query={query}
          setQuery={setQuery}
          results={results}
          online={online}
          onScan={() => setView({ kind: "scan" })}
        />
      )}

    <div
      className={cn(
        "mx-auto flex h-dvh w-full max-w-[680px] flex-col lg:max-w-none",
        view.kind !== "scan" && "lg:hidden",
      )}
      style={{ background: "#efedf4" }}
    >
      <Bar arrived={arrived} onBack={onHome ? undefined : back} />

      {!online && (
        <div className="flex-none px-[18px] py-4" style={{ background: GOLD }}>
          <p className="text-[19px] leading-[1.35] font-semibold text-ink">
            No internet here. Keep going — nothing is lost.
          </p>
        </div>
      )}

      {/* A laptop at the registration desk has room for both jobs at once:
          the list stays put on the left while a person, a group or the camera
          fills the right. On a phone only one is on screen at a time. */}
      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(340px,400px)_1fr]">
        <aside
          className={cn(
            "min-h-0 flex-col lg:flex lg:border-r lg:border-line",
            view.kind === "find" ? "flex flex-1" : "hidden",
          )}
        >
          {FindPane}
        </aside>

        <section
          className={cn(
            "min-h-0 flex-col lg:flex",
            view.kind === "find" ? "hidden lg:flex" : "flex flex-1",
          )}
        >
          {view.kind === "person" && person !== null && (
            <PersonView
              person={person}
              people={people}
              isIn={isIn}
              onCheckIn={(entry) => markIn([entry])}
              onOpen={(id) => setView({ kind: "person", id })}
              onUndo={(entry) => {
                undoOne(entry);
                back();
              }}
            />
          )}

          {view.kind === "sponsor" && (
            <div className="flex min-h-0 flex-1 flex-col bg-white">
              <SponsorSheet
                org={seatsOf(view.number)[0]?.group ?? "Sponsor seats"}
                seats={seatsOf(view.number)}
                isIn={isIn}
                onClaim={claimSeat}
                onUndo={releaseSeat}
                onClose={back}
              />
            </div>
          )}

          {view.kind === "groupCount" &&
            (() => {
              const group = groupFor(view.label);
              if (group === null) return null;
              const waiting = group.members.filter(
                (entry) => !isIn(entry),
              ).length;
              return (
                <GroupCount
                  label={group.label}
                  total={group.members.length}
                  waiting={waiting}
                  onNext={(expected) => {
                    setPicked(new Set());
                    setView({
                      kind: "groupPick",
                      label: group.label,
                      expected,
                    });
                  }}
                />
              );
            })()}

          {view.kind === "groupPick" &&
            (() => {
              const group = groupFor(view.label);
              if (group === null) return null;
              const waiting = group.members.filter((entry) => !isIn(entry));
              const short = view.expected - picked.size;
              return (
                <>
                  <div
                    className="flex-none px-[18px] pt-4 pb-3.5"
                    style={{ background: HEADER }}
                  >
                    <p className="font-display text-[23px] leading-[1.2] font-bold text-white">
                      {short > 0
                        ? `Tap the ${view.expected} who are here`
                        : `All ${view.expected} tapped`}
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-2">
                    <ul className="flex flex-col gap-2.5">
                      {waiting.map((entry) => {
                        const on = picked.has(entry.id);
                        return (
                          <li key={entry.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setPicked((current) => {
                                  const next = new Set(current);
                                  if (next.has(entry.id)) next.delete(entry.id);
                                  else next.add(entry.id);
                                  return next;
                                });
                                buzz(8);
                              }}
                              className="flex min-h-[72px] w-full items-center gap-3.5 rounded-2xl p-4 text-left"
                              style={
                                on
                                  ? { background: PURPLE }
                                  : {
                                      background: "#fff",
                                      border: `2px solid ${HAIRLINE}`,
                                    }
                              }
                            >
                              <span
                                className="flex size-8 flex-none items-center justify-center rounded-lg text-[19px] leading-none font-bold"
                                style={
                                  on
                                    ? { background: GOLD, color: "#191528" }
                                    : {
                                        border: `2px solid ${BORDER}`,
                                        color: "transparent",
                                      }
                                }
                              >
                                ✓
                              </span>
                              <span
                                className="text-[19px] leading-[1.25] font-semibold"
                                style={{ color: on ? "#fff" : "#191528" }}
                              >
                                {entry.name}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div
                    className="flex-none border-t bg-white px-3.5 py-3"
                    style={{ borderColor: HAIRLINE }}
                  >
                    {short > 0 ? (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[17px]" style={{ color: BODY }}>
                          Tap {short} more
                        </p>
                        {/* The leader said twelve and eleven are standing there.
                        One tap fixes the number instead of starting over. */}
                        <button
                          type="button"
                          disabled={picked.size === 0}
                          onClick={() =>
                            setView({
                              kind: "groupPick",
                              label: view.label,
                              expected: picked.size,
                            })
                          }
                          className="text-[17px] font-semibold underline disabled:opacity-40"
                          style={{ color: PURPLE }}
                        >
                          Only {picked.size} came
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const chosen = waiting.filter((entry) =>
                            picked.has(entry.id),
                          );
                          markIn(chosen);
                          setPicked(new Set());
                          setView({
                            kind: "groupDone",
                            label: view.label,
                            names: chosen,
                          });
                        }}
                        className="h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
                        style={{ background: PURPLE }}
                      >
                        Let these {picked.size} in
                      </button>
                    )}
                  </div>
                </>
              );
            })()}

          {view.kind === "groupDone" && (
            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-[18px] pt-8 pb-8">
              <p className="font-display text-[30px] leading-[1.15] font-bold text-ink">
                {view.names.length} are in
              </p>
              <p
                className="mt-2 text-[18px] leading-[1.4]"
                style={{ color: BODY }}
              >
                {view.label}. Send them in — anyone else can arrive later on
                their own.
              </p>
              <ul className="mt-5 flex flex-col gap-2">
                {view.names.map((entry) => (
                  <li key={entry.id} className="text-[17px] text-ink">
                    {entry.name}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={back}
                className="mt-8 h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
                style={{ background: PURPLE }}
              >
                Next person
              </button>
              <button
                type="button"
                onClick={() => {
                  for (const entry of view.names) undoOne(entry);
                  back();
                }}
                className="mt-5 text-[17px] font-semibold text-[#6e6885] underline"
              >
                Undo all {view.names.length}
              </button>
            </div>
          )}

          {view.kind === "scan" && (
            <div className="flex min-h-0 flex-1 flex-col bg-white">
              <div className="relative min-h-0 flex-1 overflow-hidden bg-ink">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="size-full object-cover"
                />

                {/* The box is not decoration: only what lands inside it is
                    read, so aiming at the right phone in a crowded queue is
                    something the volunteer controls. On a read it closes in and
                    turns gold — the one moment of feedback that says the phone
                    got it, before anything else moves. */}
                {scan.kind === "waiting" && !starting && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className="relative aspect-square w-[72%] max-w-[340px] transition-all duration-200 ease-out"
                      style={{
                        transform: hit !== null ? "scale(0.88)" : "scale(1)",
                        opacity: ready ? 1 : 0.35,
                      }}
                    >
                      {[
                        "top-0 left-0 rounded-tl-2xl border-t-4 border-l-4",
                        "top-0 right-0 rounded-tr-2xl border-t-4 border-r-4",
                        "bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4",
                        "right-0 bottom-0 rounded-br-2xl border-r-4 border-b-4",
                      ].map((corner) => (
                        <span
                          key={corner}
                          className={cn(
                            "absolute size-10 transition-colors duration-200",
                            corner,
                          )}
                          style={{
                            borderColor:
                              hit !== null ? GOLD : "rgba(255,255,255,.95)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {starting && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-[19px] font-semibold text-white">
                      Opening the camera…
                    </p>
                  </div>
                )}

                {/* The caption is the handover. It stops asking for a code and
                    names the person a moment before their card arrives, so the
                    card is a continuation rather than a jump cut. */}
                {scan.kind === "waiting" && !starting && (
                  <p
                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-[18px] pt-10 pb-5 text-[19px] leading-[1.35] font-semibold transition-colors duration-200"
                    style={{ color: hit !== null ? GOLD : "#fff" }}
                  >
                    {hitPerson?.name ??
                      (hit?.kind === "sponsor"
                        ? "Sponsor seats"
                        : ready
                          ? "Hold their code inside the box"
                          : "Next person, please")}
                  </p>
                )}

                {torch.available && !starting && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className="absolute top-4 right-4 rounded-full px-4 py-3 text-[15px] font-semibold"
                    style={
                      torch.on
                        ? { background: GOLD, color: "#191528" }
                        : { background: "rgba(0,0,0,.55)", color: "#fff" }
                    }
                  >
                    {torch.on ? "Light on" : "Light"}
                  </button>
                )}

                {/* The confirmation itself: the same card the manual flow
                    shows, riding up over a held frame instead of replacing the
                    screen. Tapping the frame above it is a way out for a code
                    read off the wrong phone. */}
                {hit !== null && (hitPerson !== null || hit.kind === "sponsor") && (
                  <>
                    <button
                      type="button"
                      aria-label="Not them — keep scanning"
                      onClick={closeHit}
                      className="absolute inset-0 bg-black/45 transition-opacity duration-200"
                      style={{ opacity: hit.stage === "open" ? 1 : 0 }}
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 flex max-h-[86%] flex-col overflow-hidden rounded-t-3xl bg-white transition-transform duration-300 ease-out"
                      style={{
                        transform:
                          hit.stage === "open"
                            ? "translateY(0)"
                            : "translateY(100%)",
                      }}
                    >
                      <div className="flex-none pt-2.5 pb-1">
                        <span
                          className="mx-auto block h-1.5 w-11 rounded-full"
                          style={{ background: BORDER }}
                        />
                      </div>
                      {hit.kind === "sponsor" ? (
                        <SponsorSheet
                          org={
                            seatsOf(hit.number)[0]?.group ?? "Sponsor seats"
                          }
                          seats={seatsOf(hit.number)}
                          isIn={isIn}
                          onClaim={claimSeat}
                          onUndo={releaseSeat}
                          onClose={closeHit}
                        />
                      ) : hitPerson === null ? null : (
                      <ScanSheet
                        person={hitPerson}
                        people={people}
                        isIn={isIn}
                        onCheckIn={(entry) => markIn([entry])}
                        // Undo leaves the card open. Somebody who has just
                        // undone a check-in is fixing something, and throwing
                        // them back to the camera mid-fix is how it gets done
                        // twice.
                        onUndo={undoOne}
                        onClose={closeHit}
                      />
                      )}
                    </div>
                  </>
                )}
              </div>

              {scan.kind === "nocamera" && (
                <div className="flex-none px-[18px] py-5">
                  <p className="font-display text-[27px] leading-[1.15] font-bold text-ink">
                    The camera won&rsquo;t open
                  </p>
                  <p
                    className="mt-2 text-[18px] leading-[1.4]"
                    style={{ color: BODY }}
                  >
                    Allow camera access for this site, or just use names — that
                    always works.
                  </p>
                  <button
                    type="button"
                    onClick={() => setView({ kind: "find" })}
                    className="mt-4 h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
                    style={{ background: PURPLE }}
                  >
                    Find them by name
                  </button>
                </div>
              )}

              {scan.kind === "unreadable" && (
                <div className="flex-none px-[18px] py-5">
                  <p className="font-display text-[27px] leading-[1.15] font-bold text-ink">
                    We can&rsquo;t read that code
                  </p>
                  <p
                    className="mt-2 text-[18px] leading-[1.4]"
                    style={{ color: BODY }}
                  >
                    Ask for their surname instead. That always works.
                  </p>
                  <button
                    type="button"
                    onClick={nextPerson}
                    className="mt-4 h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
                    style={{ background: PURPLE }}
                  >
                    Try the code again
                  </button>
                  <button
                    type="button"
                    onClick={() => setView({ kind: "find" })}
                    className="mt-4 text-[17px] font-semibold text-[#6e6885] underline"
                  >
                    Type their surname instead
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <div
        className={cn(
          "flex-none grid-cols-2 gap-2.5 border-t bg-white px-3 pt-2.5 pb-4 lg:mx-0 lg:grid lg:max-w-[400px]",
          onHome ? "grid" : "hidden",
        )}
        style={{ borderColor: HAIRLINE }}
      >
        <button
          type="button"
          onClick={() => setView({ kind: "find" })}
          className="h-16 rounded-xl text-[19px] font-semibold"
          style={
            view.kind === "find"
              ? { background: PURPLE, color: "#fff" }
              : {
                  background: "#fff",
                  border: `2px solid ${BORDER}`,
                  color: PURPLE,
                }
          }
        >
          Find a name
        </button>
        <button
          type="button"
          onClick={() => setView({ kind: "scan" })}
          className="h-16 rounded-xl text-[19px] font-semibold"
          style={
            view.kind === "scan"
              ? { background: PURPLE, color: "#fff" }
              : {
                  background: "#fff",
                  border: `2px solid ${BORDER}`,
                  color: PURPLE,
                }
          }
        >
          Scan code
        </button>
      </div>
    </div>
    </>
  );
}

function Bar({ arrived, onBack }: { arrived: number; onBack?: () => void }) {
  return (
    <div
      className="flex h-[60px] flex-none items-center justify-between gap-3 px-[18px]"
      style={{ background: HEADER }}
    >
      {onBack !== undefined ? (
        <button
          type="button"
          onClick={onBack}
          className="border-0 bg-transparent p-0 text-[17px] font-semibold text-white"
        >
          Back
        </button>
      ) : (
        <span className="font-display text-[17px] leading-none font-bold tracking-[-0.045em] text-white">
          crossgen
        </span>
      )}
      <span className="text-[16px] leading-none font-semibold text-white">
        {arrived} arrived
      </span>
    </div>
  );
}

function PersonView({
  person,
  people,
  isIn,
  onCheckIn,
  onOpen,
  onUndo,
}: {
  person: RosterEntry;
  people: RosterEntry[];
  isIn: (entry: RosterEntry) => boolean;
  onCheckIn: (entry: RosterEntry) => void;
  onOpen: (id: string) => void;
  onUndo: (entry: RosterEntry) => void;
}) {
  const [shown, setShown] = useState(false);
  const inside = isIn(person);
  const room = breakoutRoom(person.sessionNumber);
  const family = people.filter(
    (entry) =>
      entry.registrationNumber === person.registrationNumber &&
      entry.id !== person.id,
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white px-[18px] pt-[22px] pb-8">
      {inside && (
        <span
          className="inline-block rounded-lg px-3 py-2 text-[16px] leading-none font-semibold"
          style={{ background: "#e8f4f8", color: "#1d5f78" }}
        >
          Here since{" "}
          {person.checkedInAt !== null ? at(person.checkedInAt) : "just now"}
        </span>
      )}

      <p className="mt-3 font-display text-[30px] leading-[1.15] font-bold text-ink">
        {person.name}
      </p>
      <p className="mt-1.5 text-[17px] leading-[1.35]" style={{ color: BODY }}>
        {person.age !== null ? `${person.age} years old · ` : ""}
        {person.church.length > 0 ? person.church : person.registrationNumber}
      </p>

      {/* The one line that gets read out loud, so it is the biggest thing
          under their name. */}
      <div
        className="mt-7 rounded-xl px-4 py-4"
        style={{ background: room?.tint ?? "#f2effb" }}
      >
        <p
          className="text-[16px] leading-none font-semibold"
          style={{ color: room?.ink ?? PURPLE }}
        >
          Tell them to go to
        </p>
        {room !== null && (
          <>
            <p className="mt-2.5 flex items-center gap-2.5">
              <span
                className="size-7 flex-none rounded-full"
                style={{
                  background: room.hex,
                  border: `2px solid ${room.ink}`,
                }}
              />
              <span
                className="font-display text-[26px] leading-[1.1] font-bold"
                style={{ color: room.ink }}
              >
                {room.room}
              </span>
            </p>
            <p
              className="mt-1.5 text-[16px] leading-[1.3] font-semibold"
              style={{ color: room.ink }}
            >
              {room.colour} sign
              {room.roomFull !== undefined ? ` · ${room.roomFull}` : ""}
            </p>
          </>
        )}
        <p
          className="mt-2.5 text-[16px] leading-[1.3]"
          style={{ color: room?.ink ?? "#191528" }}
        >
          {person.session}
        </p>
      </div>

      {!person.cleared && (
        <div
          className="mt-6 rounded-xl px-4 py-3.5"
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

      {!inside && (
        <button
          type="button"
          onClick={() => onCheckIn(person)}
          className="mt-7 h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
          style={{ background: PURPLE }}
        >
          Check in
        </button>
      )}

      {family.length > 0 && (
        <div className="mt-7 border-t pt-5" style={{ borderColor: HAIRLINE }}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[17px] leading-[1.3] font-medium text-ink">
              {family.length} more with them
            </span>
            <button
              type="button"
              onClick={() => setShown((value) => !value)}
              className="text-[17px] font-semibold underline"
              style={{ color: PURPLE }}
            >
              {shown ? "Hide" : "Show"}
            </button>
          </div>

          {shown && (
            <ul className="mt-4 flex flex-col gap-3">
              {family.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(entry.id)}
                    className="min-w-0 flex-1 text-left text-[18px] text-ink underline"
                  >
                    {entry.name}
                  </button>
                  {isIn(entry) ? (
                    <span className="flex-none text-[16px] text-[#6e6885]">
                      Here
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onCheckIn(entry)}
                      className="flex-none rounded-xl px-4 py-3 text-[17px] font-semibold text-white"
                      style={{ background: PURPLE }}
                    >
                      Check in
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Pulled up at the desk when somebody has lost their email. */}
      <a
        href={`/pass/${person.id}`}
        target="_blank"
        rel="noreferrer"
        className="mt-7 block text-[17px] font-semibold underline"
        style={{ color: PURPLE }}
      >
        Open their code
      </a>

      {inside && (
        <button
          type="button"
          onClick={() => onUndo(person)}
          className="mt-6 text-[17px] font-semibold text-[#6e6885] underline"
        >
          Undo — they are not here
        </button>
      )}
    </div>
  );
}

/** "How many came?" — asked of the group's leader, before any names. */
function GroupCount({
  label,
  total,
  waiting,
  onNext,
}: {
  label: string;
  total: number;
  waiting: number;
  onNext: (expected: number) => void;
}) {
  const [count, setCount] = useState(waiting);
  const clamp = (value: number) => Math.max(1, Math.min(waiting, value));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white px-[18px] pt-[26px] pb-6">
      <p className="font-display text-[27px] leading-[1.15] font-bold text-ink">
        {label}
      </p>
      <p className="mt-1.5 text-[18px] leading-[1.35]" style={{ color: BODY }}>
        {total} on the list
        {waiting !== total ? `, ${total - waiting} already here` : ""}
      </p>

      <p className="mt-8 font-display text-[27px] leading-[1.25] font-bold text-ink">
        How many came?
      </p>

      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setCount((value) => clamp(value - 1))}
          className="h-[88px] flex-1 rounded-2xl text-[40px] leading-none font-semibold"
          style={{
            background: "#fff",
            border: `2px solid ${BORDER}`,
            color: PURPLE,
          }}
        >
          −
        </button>
        <span
          className="font-display text-[76px] leading-none font-bold"
          style={{ color: PURPLE }}
        >
          {count}
        </span>
        <button
          type="button"
          onClick={() => setCount((value) => clamp(value + 1))}
          className="h-[88px] flex-1 rounded-2xl text-[40px] leading-none font-semibold"
          style={{
            background: "#fff",
            border: `2px solid ${BORDER}`,
            color: PURPLE,
          }}
        >
          +
        </button>
      </div>

      <p className="mt-5 text-[18px] leading-[1.5]" style={{ color: BODY }}>
        Ask the person leading the group. Do not count heads.
      </p>

      <button
        type="button"
        onClick={() => onNext(count)}
        className="mt-auto h-[68px] w-full rounded-xl text-[21px] font-semibold text-white"
        style={{ background: PURPLE }}
      >
        Next
      </button>
    </div>
  );
}

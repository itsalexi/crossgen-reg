"use client";

import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import {
  BREAKOUT_SESSIONS,
  REGISTRATION_TYPES,
  type RegistrationType,
} from "@convex/shared";
import { Button, Callout, Eyebrow } from "@/components/ui";

const CONTROL =
  "h-10 w-full min-w-0 rounded-[10px] border border-line bg-white px-3 text-[14px] text-ink";

/**
 * Splits a pasted list into names.
 *
 * Churches send them numbered, bulleted, or one per line, and often with a
 * heading on top. Everything that is not a name gets stripped rather than
 * making somebody tidy the list by hand before pasting it.
 */
export function parseNames(text: string): string[] {
  return text
    .split("\n")
    .map((line) =>
      line
        // "1." / "12)" / "3.." at the start, and bullets
        .replace(/^\s*\d+\s*[.)\]]*\s*/, "")
        .replace(/^\s*[-*•]\s*/, "")
        .trim(),
    )
    .filter((line) => line.length > 0)
    // A heading like "Church of the Nazarene-GMA participants to CrossGen…"
    .filter((line) => !/participants?\s+to\s+/i.test(line))
    .filter((line) => line.length <= 120);
}

export function AddRegistration({ onAdded }: { onAdded: () => void }) {
  const add = useMutation(api.organizer.addRegistration);

  const [open, setOpen] = useState(false);
  const [names, setNames] = useState("");
  const [groupName, setGroupName] = useState("");
  const [church, setChurch] = useState("");
  const [city, setCity] = useState("");
  const [reference, setReference] = useState("");
  const [type, setType] = useState<RegistrationType>("regular");
  const [session, setSession] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const parsed = useMemo(() => parseNames(names), [names]);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        + Add people by hand
      </Button>
    );
  }

  const submit = () => {
    setBusy(true);
    setError(null);
    void add({
      groupName: groupName.trim() || undefined,
      // The typed name is also the group, so a church sending two lists on
      // different days lands both in one place.
      groupKey: groupName.trim() || undefined,
      registrationType: type,
      paymentReference: reference.trim() || undefined,
      churchOrganization: church.trim() || undefined,
      cityMunicipality: city.trim() || undefined,
      breakoutSession: session as 1 | 2 | 3 | 4 | 5,
      people: parsed.map((fullName) => ({ fullName })),
    })
      .then((result) => {
        setDone(`${result.registrationNumber}: ${result.added} added`);
        setNames("");
        onAdded();
      })
      .catch((caught) =>
        setError(
          caught instanceof ConvexError
            ? String(caught.data)
            : "Could not add them.",
        ),
      )
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow>Add people by hand</Eyebrow>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[13px] text-muted hover:text-cg-purple hover:underline"
        >
          Close
        </button>
      </div>

      <p className="text-[13.5px] leading-relaxed text-muted">
        For people who could not use the form, usually a church sending a list
        after registration closed. Only the names are required. Paste them one
        per line, numbered or not.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink">Names</span>
        <textarea
          rows={8}
          value={names}
          onChange={(e) => setNames(e.target.value)}
          placeholder={"1. Alexis Lyn Villanueva\n2. Angelo Villanueva\n3. Ivee Abenojar"}
          className="w-full rounded-[10px] border border-line bg-white px-3 py-2.5 font-mono text-[13px] text-ink"
        />
        <span className="text-[12.5px] text-muted">
          {parsed.length === 0
            ? "Nothing yet."
            : `${parsed.length} ${parsed.length === 1 ? "name" : "names"} read.`}
        </span>
      </label>

      {parsed.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-line-soft bg-surface px-3 py-2.5 text-[13px] text-ink">
          {parsed.map((name, index) => (
            <span key={`${name}-${index}`}>{name}</span>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Group name</span>
          <input
            className={CONTROL}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Church of the Nazarene GMA"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">
            Church / organization
          </span>
          <input
            className={CONTROL}
            value={church}
            onChange={(e) => setChurch(e.target.value)}
            placeholder="Applied to everyone on this list"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">
            City / municipality
          </span>
          <input
            className={CONTROL}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="GMA, Cavite"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">
            Payment reference
          </span>
          <input
            className={CONTROL}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="So finance can trace it"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Type</span>
          <select
            className={CONTROL}
            value={type}
            onChange={(e) => setType(e.target.value as RegistrationType)}
          >
            {REGISTRATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.short}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Workshop</span>
          {/* All five, not just the open ones: a room being full for the
              public does not stop the team seating someone deliberately. */}
          <select
            className={CONTROL}
            value={session}
            onChange={(e) => setSession(Number(e.target.value))}
          >
            {BREAKOUT_SESSIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.value}. {s.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error !== null && <Callout tone="error">{error}</Callout>}
      {done !== null && <Callout tone="teal">{done}</Callout>}

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <Button
          size="sm"
          loading={busy}
          disabled={parsed.length === 0}
          onClick={submit}
        >
          Add {parsed.length > 0 ? parsed.length : ""}{" "}
          {parsed.length === 1 ? "person" : "people"}
        </Button>
        <span className="text-[12.5px] text-muted">
          No confirmation email is sent, since there is usually no address yet.
        </span>
      </div>
    </div>
  );
}

"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui";
import { Panel } from "./parts";

/**
 * Sponsors and the seats they bought before they had names for them.
 *
 * Making one here creates the seats and the code in the same breath. The code
 * goes on whatever ticket the sponsor sends out; the names arrive at the door,
 * typed by a volunteer, and land back on this page as a count.
 */
export function SponsorsSection() {
  const pools = useQuery(api.sponsors.pools);
  const createPool = useMutation(api.sponsors.createPool);
  const addSeats = useMutation(api.sponsors.addSeats);

  const [org, setOrg] = useState("");
  const [seats, setSeats] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    const count = Number(seats);
    if (org.trim().length === 0) {
      setError("Name the sponsor.");
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setError("How many seats? A whole number.");
      return;
    }
    setBusy(true);
    try {
      await createPool({ org: org.trim(), seats: count });
      setOrg("");
      setSeats("10");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Add a sponsor">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="block font-medium text-ink">Sponsor</span>
            <input
              value={org}
              onChange={(event) => setOrg(event.target.value)}
              placeholder="Organization on the ticket"
              className="mt-1.5 h-11 w-full rounded-lg border-2 border-line px-3 text-[15px] text-ink"
            />
          </label>
          <label className="text-sm sm:w-32">
            <span className="block font-medium text-ink">Seats</span>
            <input
              value={seats}
              inputMode="numeric"
              onChange={(event) => setSeats(event.target.value)}
              className="no-spinner mt-1.5 h-11 w-full rounded-lg border-2 border-line px-3 text-[15px] text-ink"
            />
          </label>
          <Button loading={busy} onClick={() => void create()}>
            Create seats
          </Button>
        </div>
        {error !== null && (
          <p className="mt-3 text-sm text-red-700">{error}</p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Creates that many empty seats and one code for all of them. Everyone
          lands in the plenary, and any of them can be moved afterwards like a
          normal registration.
        </p>
      </Panel>

      <Panel title="Sponsors">
        {pools === undefined ? (
          <p className="text-sm text-muted">Loading.</p>
        ) : pools.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            None yet. A sponsor added here gets a code its guests can all use,
            and the names are taken at the door.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {pools.map((pool) => (
              <li
                key={pool.registrationNumber}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">
                    {pool.org}
                  </p>
                  <p className="text-sm text-muted">
                    {pool.claimed} named · {pool.seats} seats ·{" "}
                    {pool.registrationNumber}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const more = window.prompt("How many more seats?", "5");
                      if (more === null) return;
                      const count = Number(more);
                      if (!Number.isInteger(count) || count < 1) return;
                      void addSeats({
                        registrationNumber: pool.registrationNumber,
                        seats: count,
                      });
                    }}
                    className="text-sm font-semibold text-cg-purple underline"
                  >
                    Add seats
                  </button>
                  <a
                    href={`/sponsor/${pool.registrationNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-cg-purple underline"
                  >
                    Open ticket
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

"use client";

import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { formatPeso } from "@convex/shared";
import { Button, Eyebrow, Pill, cn } from "@/components/ui";
import {
  buildGroups,
  summarize,
  type Group,
  type GroupDecision,
} from "@/lib/groups";
import type { Row } from "@/lib/organizer";
import { Panel, StatTile } from "./parts";

type Payment = Doc<"payments">;

const CONTROL =
  "h-9 w-full min-w-0 rounded-[10px] border border-line bg-white px-3 text-[14px] text-ink";

/** Picks a registration from anywhere in the event and pins it to a group. */
function AddToGroup({
  candidates,
  onPick,
  label = "Add a registration",
}: {
  candidates: Row[];
  onPick: (registrationId: Id<"registrations">) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const needle = search.toLowerCase().trim();
    const pool =
      needle.length === 0
        ? candidates
        : candidates.filter((row) =>
            [
              row.registration.registrationNumber,
              row.registration.groupName ?? "",
              row.registration.registrantEmail,
              row.registration.paymentReference ?? "",
              ...row.participants.map((p) => p.fullName),
            ]
              .join(" ")
              .toLowerCase()
              .includes(needle),
          );
    return pool.slice(0, 8);
  }, [candidates, search]);

  if (!open) {
    return (
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        + {label}
      </Button>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="search"
          className={CONTROL}
          placeholder="Name, number, reference"
          aria-label="Find a registration"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          size="sm"
          variant="quiet"
          onClick={() => {
            setOpen(false);
            setSearch("");
          }}
        >
          Cancel
        </Button>
      </div>

      {matches.length === 0 ? (
        <p className="px-1 py-2 text-[13px] text-muted">Nothing matches.</p>
      ) : (
        <ul className="flex flex-col">
          {matches.map((row) => (
            <li key={row.registration._id}>
              <button
                type="button"
                onClick={() => {
                  onPick(row.registration._id);
                  setOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-baseline gap-2 rounded-lg px-2 py-2 text-left text-[13.5px] hover:bg-white"
              >
                <span className="font-semibold text-cg-purple">
                  {row.registration.registrationNumber}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {row.participants.map((p) => p.fullName).join(", ")}
                </span>
                <span className="flex-none text-[12.5px] text-muted">
                  {row.registration.groupName ?? "on their own"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > matches.length && (
        <p className="px-1 text-[12.5px] text-muted">
          {candidates.length - matches.length} more — keep typing to narrow it
          down.
        </p>
      )}
    </div>
  );
}

/** What is wrong, in the colour of how wrong it is — and a way to close it. */
function IssueLines({ group }: { group: Group }) {
  const dismiss = useMutation(api.organizer.dismissGroupIssue);
  const restore = useMutation(api.organizer.restoreGroupIssue);

  if (group.issues.length === 0 && group.settled.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1">
      {group.issues.map((issue) => (
        <li key={issue.kind} className="flex flex-wrap items-baseline gap-2">
          <span
            className={cn(
              "text-[13.5px] font-medium",
              issue.kind === "short"
                ? "text-red-600"
                : issue.kind === "over"
                  ? "text-cg-gold-ink"
                  : "text-muted",
            )}
          >
            {issue.text}
          </span>
          {/* Some of these are a wrong claim rather than wrong data, and only
              someone who asked can close them. */}
          <button
            type="button"
            onClick={() =>
              void dismiss({ groupKey: group.key, kind: issue.kind })
            }
            className="text-[12.5px] text-muted hover:text-cg-purple hover:underline"
          >
            that's fine
          </button>
        </li>
      ))}
      {group.settled.map((issue) => (
        <li key={issue.kind} className="flex flex-wrap items-baseline gap-2">
          <span className="text-[13px] text-faint line-through">
            {issue.text}
          </span>
          <span className="text-[12.5px] text-faint">
            settled by {issue.byEmail}
            {issue.note !== undefined ? ` · ${issue.note}` : ""}
          </span>
          <button
            type="button"
            onClick={() =>
              void restore({ groupKey: group.key, kind: issue.kind })
            }
            className="text-[12.5px] text-muted hover:text-cg-purple hover:underline"
          >
            put back
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Marks a group that only adds up because someone said so, with the way back.
 * Without this a mis-click is invisible: the group drops out of the pile that
 * needs sorting and the undo goes with it.
 */
function SettledMark({
  groupKey,
  issue,
}: {
  groupKey: string;
  issue: Group["settled"][number];
}) {
  const restore = useMutation(api.organizer.restoreGroupIssue);

  return (
    <span className="flex flex-none items-baseline gap-1.5">
      <Pill tone="muted">settled: {issue.text}</Pill>
      <button
        type="button"
        onClick={() => void restore({ groupKey, kind: issue.kind })}
        className="text-[12.5px] text-muted hover:text-cg-purple hover:underline"
      >
        put back
      </button>
    </span>
  );
}

/**
 * What each deposit was, next to what it covered. A group paying under one
 * reference is one line; UpperRoom paying under seven is seven, which is the
 * whole reason this is a list rather than a total.
 */
function PaymentLines({ group }: { group: Group }) {
  if (group.references.length === 0) {
    return <p className="text-[13px] text-muted">Nobody here is paying.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {group.references.map((entry) => {
        const shared = entry.peopleTotal > entry.peopleHere;
        const amount = entry.record?.amountReceived ?? 0;
        const share = shared
          ? (amount / entry.peopleTotal) * entry.peopleHere
          : amount;
        const status = entry.record?.status ?? "received";

        return (
          <li
            key={entry.reference}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]"
          >
            <span className="font-mono text-ink">{entry.reference}</span>
            <span className="text-muted">
              {entry.peopleHere} {entry.peopleHere === 1 ? "person" : "people"}
              {shared ? ` of the ${entry.peopleTotal} it covered` : ""}
            </span>
            <span className="flex-1" />
            {entry.record === undefined ? (
              <span className="text-cg-gold-ink">not checked yet</span>
            ) : status === "unpaid" ? (
              <span className="text-muted">nothing arrived</span>
            ) : (
              <span className="font-medium text-ink">
                {shared ? "≈" : ""}
                {formatPeso(Math.round(share))}
                {shared && (
                  <span className="font-normal text-muted">
                    {" "}
                    of {formatPeso(amount)}
                  </span>
                )}
                {status === "problem" && (
                  <span className="ml-1.5 font-normal text-cg-gold-ink">
                    needs sorting
                  </span>
                )}
              </span>
            )}
            {entry.record?.note !== undefined && (
              <span className="w-full text-[12.5px] text-faint">
                {entry.record.note}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function GroupCard({
  group,
  candidates,
  onOpen,
  onCollapse,
}: {
  group: Group;
  candidates: Row[];
  onOpen: (registrationId: Id<"registrations">) => void;
  onCollapse?: () => void;
}) {
  const assign = useMutation(api.organizer.assignGroup);
  const worst = group.issues[0];

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-white p-5",
        worst === undefined
          ? "border-line"
          : worst.kind === "short"
            ? "border-red-300"
            : worst.kind === "over"
              ? "border-cg-gold/60"
              : "border-line",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[17px] font-semibold text-ink">
              {group.label}
            </h3>
            {group.flags.map((flag) => (
              <Pill key={flag.key} tone="muted">
                {flag.text}
              </Pill>
            ))}
          </div>
          <p className="mt-1 text-[13.5px] text-muted">
            {group.people} {group.people === 1 ? "person" : "people"} ·{" "}
            {group.rows.length} registration{group.rows.length === 1 ? "" : "s"}
            {group.pinned > 0 ? ` · ${group.pinned} placed by hand` : ""}
          </p>
          <div className="mt-1.5">
            <IssueLines group={group} />
          </div>
          {group.spellings.length > 1 && (
            <p className="mt-1 text-[12.5px] text-faint">
              Typed as {group.spellings.map((s) => `"${s}"`).join(", ")}
            </p>
          )}
        </div>

        <div className="text-right">
          <Eyebrow>At ₱{group.rate}/head</Eyebrow>
          <p className="font-display text-[18px] font-bold text-ink">
            {group.approximate ? "≈" : ""}
            {formatPeso(group.received)}
            <span className="text-[13px] font-medium text-muted">
              {" "}
              of {formatPeso(group.expected)}
            </span>
          </p>
          {onCollapse !== undefined && (
            <button
              type="button"
              onClick={onCollapse}
              className="text-[12.5px] text-muted hover:text-cg-purple hover:underline"
            >
              collapse
            </button>
          )}
        </div>
      </div>

      {/* One block per registration, because that is the unit people were
          actually entered in — and the unit that gets moved between groups. */}
      <ul className="flex flex-col gap-2">
        {group.rows.map((row) => (
          <li
            key={row.registration._id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line-soft bg-surface px-3 py-2.5"
          >
            <button
              type="button"
              onClick={() => onOpen(row.registration._id)}
              className="flex-none text-[13px] font-semibold text-cg-purple hover:underline"
            >
              {row.registration.registrationNumber}
            </button>
            <div className="flex min-w-0 flex-1 flex-wrap gap-x-2.5 gap-y-1">
              {row.participants.map((p) => (
                <span key={p._id} className="text-[13.5px] text-ink">
                  {p.fullName}
                </span>
              ))}
            </div>
            {row.registration.paymentReference !== undefined && (
              <span className="flex-none font-mono text-[12px] text-muted">
                {row.registration.paymentReference}
              </span>
            )}
            {row.registration.groupKey !== undefined && (
              <button
                type="button"
                title="Go back to the group name they typed"
                onClick={() =>
                  void assign({
                    registrationId: row.registration._id,
                    groupKey: null,
                  })
                }
                className="flex-none text-[12.5px] text-muted hover:text-cg-purple hover:underline"
              >
                undo
              </button>
            )}
            <button
              type="button"
              title="Take this registration out of the group"
              onClick={() =>
                void assign({
                  registrationId: row.registration._id,
                  groupKey: "",
                })
              }
              className="flex-none text-[12.5px] text-muted hover:text-red-600 hover:underline"
            >
              remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <Eyebrow>
          {group.references.length === 1
            ? "Payment"
            : `Payments · ${group.references.length} references`}
        </Eyebrow>
        <PaymentLines group={group} />
      </div>

      <div className="border-t border-line pt-3">
        <AddToGroup
          candidates={candidates}
          onPick={(registrationId) =>
            void assign({ registrationId, groupKey: group.key })
          }
        />
      </div>
    </li>
  );
}

export function GroupsSection({
  rows,
  allRows,
  payments,
  decisions,
  onOpen,
}: {
  rows: Row[];
  allRows: Row[];
  payments: Payment[];
  decisions: GroupDecision[];
  onOpen: (registrationId: Id<"registrations">) => void;
}) {
  const assign = useMutation(api.organizer.assignGroup);
  const { groups, alone } = useMemo(
    () => buildGroups(rows, allRows, payments, decisions),
    [rows, allRows, payments, decisions],
  );
  const totals = useMemo(() => summarize(groups, alone), [groups, alone]);
  const [pickFor, setPickFor] = useState<Id<"registrations"> | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const needsAttention = groups.filter((g) => g.issues.length > 0);
  const settled = groups.filter((g) => g.issues.length === 0);

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Anything not already in a group can be pulled into it.
  const candidatesFor = (group: Group) =>
    allRows.filter(
      (row) =>
        !group.rows.some((r) => r.registration._id === row.registration._id),
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Groups"
          value={String(totals.groups)}
          note={`${totals.grouped} people came with someone`}
        />
        <StatTile
          label="Need sorting"
          tone="warn"
          value={String(totals.needsALook)}
          note={`${settled.length} group${settled.length === 1 ? "" : "s"} add up`}
        />
        <StatTile
          label="Missing money"
          tone="warn"
          value={formatPeso(totals.shortfall)}
          note="across groups whose deposits have all been checked"
        />
        <StatTile
          label="On their own"
          value={String(totals.alone)}
          note="no group name given"
        />
      </div>

      <p className="text-[14px] leading-relaxed text-muted">
        Worst first. Groups are guessed from the name people typed, which was
        free text — the same group was written five different ways. Where the
        guess is wrong, move the registration: what you set here wins over what
        was typed.
      </p>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white py-16 text-center text-[15px] text-muted">
          Nobody has given a group name yet.
        </p>
      ) : (
        <>
          {needsAttention.length > 0 && (
            <section className="flex flex-col gap-2">
              <Eyebrow>Need sorting · {needsAttention.length}</Eyebrow>
              <ul className="flex flex-col gap-3">
                {needsAttention.map((group) => (
                  <GroupCard
                    key={group.key}
                    group={group}
                    candidates={candidatesFor(group)}
                    onOpen={onOpen}
                  />
                ))}
              </ul>
            </section>
          )}

          {settled.length > 0 && (
            <section className="flex flex-col gap-2">
              <Eyebrow>These add up · {settled.length}</Eyebrow>
              {/* Collapsed by default: they are here to be found, not read. */}
              <ul className="flex flex-col gap-3">
                {settled.map((group) =>
                  expanded.has(group.key) ? (
                    <GroupCard
                      key={group.key}
                      group={group}
                      candidates={candidatesFor(group)}
                      onOpen={onOpen}
                      onCollapse={() => toggle(group.key)}
                    />
                  ) : (
                    <li
                      key={group.key}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-line bg-white px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(group.key)}
                        className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 text-left"
                      >
                        <span className="text-[14.5px] font-semibold text-ink">
                          {group.label}
                        </span>
                        <span className="text-[13px] text-muted">
                          {group.people}{" "}
                          {group.people === 1 ? "person" : "people"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-faint">
                          {group.rows
                            .flatMap((r) =>
                              r.participants.map((p) => p.fullName),
                            )
                            .join(", ")}
                        </span>
                      </button>
                      {/* A group only reaches this pile for one of two reasons,
                          and "somebody said it was fine" is the one you have to
                          be able to take back without hunting for it. */}
                      {group.settled.map((issue) => (
                        <SettledMark
                          key={issue.kind}
                          groupKey={group.key}
                          issue={issue}
                        />
                      ))}
                      <span className="flex-none text-[13px] font-medium text-ink">
                        {group.approximate ? "≈" : ""}
                        {formatPeso(group.received)}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}
        </>
      )}

      {alone.length > 0 && (
        <Panel title={`On their own · ${alone.length}`}>
          <ul className="flex flex-col">
            {alone.map((row) => (
              <li
                key={row.registration._id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft py-2.5 first:border-0"
              >
                <button
                  type="button"
                  onClick={() => onOpen(row.registration._id)}
                  className="flex-none text-[13px] font-semibold text-cg-purple hover:underline"
                >
                  {row.registration.registrationNumber}
                </button>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                  {row.participants.map((p) => p.fullName).join(", ")}
                </span>
                {pickFor === row.registration._id ? (
                  <select
                    autoFocus
                    className="h-9 max-w-[220px] rounded-[10px] border border-line bg-white px-2 text-[13px] text-ink"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value.length > 0) {
                        void assign({
                          registrationId: row.registration._id,
                          groupKey: e.target.value,
                        });
                      }
                      setPickFor(null);
                    }}
                  >
                    <option value="">Choose a group…</option>
                    {groups.map((group) => (
                      <option key={group.key} value={group.key}>
                        {group.label} ({group.people})
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickFor(row.registration._id)}
                    className="flex-none text-[12.5px] font-medium text-cg-purple hover:underline"
                  >
                    put in a group
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { formatDatePaid, formatPeso } from "@convex/shared";
import { Button, Callout, Eyebrow, Pill, cn } from "@/components/ui";
import type { Id } from "@convex/_generated/dataModel";
import type { Row } from "@/lib/organizer";
import { StatTile } from "./parts";

type Payment = Doc<"payments">;

type Status = "received" | "unpaid" | "problem";

function statusOf(record: Payment | undefined): Status | undefined {
  if (record === undefined) return undefined;
  return (record.status ?? "received") as Status;
}

const STATUS_LABEL: Record<Status, string> = {
  received: "Received",
  unpaid: "Not paid yet",
  problem: "Needs sorting",
};

/**
 * One deposit often covers several people — 31 references across 65 imported
 * participants — so reconciliation groups by reference rather than by
 * registration.
 */
type Group = {
  reference: string;
  rows: Row[];
  people: number;
  expected: number;
  expectedKnown: boolean;
  datePaid?: string;
  receipts: {
    label: string;
    url?: string;
    internal: boolean;
    storageId?: Id<"_storage">;
    fileName?: string;
    registrationId: Id<"registrations">;
  }[];
  record?: Payment;
};

function buildGroups(rows: Row[], payments: Payment[]): Group[] {
  const byReference = new Map<string, Row[]>();
  for (const row of rows) {
    if (row.registration.paymentType !== "paid") continue;
    const reference = (row.registration.paymentReference ?? "").trim();
    const key = reference.length > 0 ? reference : "(no reference)";
    byReference.set(key, [...(byReference.get(key) ?? []), row]);
  }

  const recordFor = new Map(payments.map((p) => [p.reference, p]));

  return [...byReference.entries()]
    .map(([reference, group]) => {
      const known = group.filter((r) => r.registration.amountUnknown !== true);
      return {
        reference,
        rows: group,
        people: group.reduce((sum, r) => sum + r.participants.length, 0),
        expected: known.reduce((sum, r) => sum + r.registration.totalAmount, 0),
        // False when any row in the group came from the Google Form, which
        // recorded that a payment happened but not how much.
        expectedKnown: known.length === group.length,
        datePaid: group[0].registration.datePaid,
        receipts: group.map((r) => ({
          label: r.registration.registrationNumber,
          url: r.registration.paymentProofExternalUrl,
          internal: r.registration.paymentProofStorageId !== undefined,
          storageId: r.registration.paymentProofStorageId,
          fileName: r.registration.paymentProofFileName,
          registrationId: r.registration._id,
        })),
        record: recordFor.get(reference),
      };
    })
    .sort((a, b) => {
      // Things needing a decision float up: broken first, then untouched,
      // then known-unpaid, then the ones that are settled.
      const rank = (g: Group) => {
        const status = statusOf(g.record);
        if (status === "problem") return 0;
        if (status === undefined) return 1;
        if (status === "unpaid") return 2;
        return 3;
      };
      const diff = rank(a) - rank(b);
      return diff !== 0 ? diff : a.reference.localeCompare(b.reference);
    });
}

function isImage(name: string | undefined): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(name ?? "");
}

function GroupCard({
  group,
  onOpen,
  fileUrls,
  onZoom,
}: {
  group: Group;
  onOpen: (registrationId: Id<"registrations">) => void;
  fileUrls: Record<string, string | null>;
  onZoom: (src: string, label: string) => void;
}) {
  const record = useMutation(api.organizer.recordPayment);
  const clear = useMutation(api.organizer.clearPayment);

  const [amount, setAmount] = useState(
    group.record ? String(group.record.amountReceived) : "",
  );
  const [note, setNote] = useState(group.record?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = statusOf(group.record);
  const reconciled = status === "received";
  const mismatch =
    reconciled &&
    group.expectedKnown &&
    group.record!.amountReceived !== group.expected;

  const save = (next: Status) => {
    setBusy(true);
    setError(null);
    void record({
      reference: group.reference,
      status: next,
      // Keep the figure on a flagged deposit: "needs sorting" is usually a
      // part-payment, and zeroing it loses the only record of what arrived.
      amountReceived: next === "unpaid" ? 0 : Number(amount || 0),
      note: note.trim() || undefined,
    })
      .catch((caught) =>
        setError(
          caught instanceof ConvexError
            ? String(caught.data)
            : "Could not save that.",
        ),
      )
      .finally(() => setBusy(false));
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-white p-5",
        status === "received"
          ? "border-line"
          : status === "problem"
            ? "border-red-300"
            : status === "unpaid"
              ? "border-line bg-surface"
              : "border-cg-gold/50",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[15px] font-semibold text-ink">
              {group.reference}
            </p>
            {status === "unpaid" && <Pill tone="muted">Not paid yet</Pill>}
            {status === "problem" && <Pill tone="gold">Needs sorting</Pill>}
          </div>
          <p className="mt-1 text-[13.5px] text-muted">
            {group.people} {group.people === 1 ? "person" : "people"} ·{" "}
            {group.rows.length} registration
            {group.rows.length === 1 ? "" : "s"}
            {group.datePaid ? ` · paid ${formatDatePaid(group.datePaid)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <Eyebrow>Expected</Eyebrow>
          <p className="font-display text-[18px] font-bold text-ink">
            {group.expectedKnown ? formatPeso(group.expected) : "—"}
          </p>
          {!group.expectedKnown && (
            <p className="text-[12px] text-muted">not recorded</p>
          )}
        </div>
      </div>

      {/* Straight into the registration, which is where a wrong reference or a
          misspelled name actually gets fixed. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13px]">
        {group.rows.flatMap((row) =>
          row.participants.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => onOpen(row.registration._id)}
              title={`Open ${row.registration.registrationNumber}`}
              className="rounded-md px-1.5 py-0.5 text-muted underline decoration-line underline-offset-2 transition-colors hover:bg-cg-purple-tint hover:text-cg-purple hover:decoration-cg-purple-soft"
            >
              {p.fullName}
            </button>
          )),
        )}
      </div>

      {/* Uploaded receipts are shown here so a deposit can be checked without
          leaving the page. Drive-hosted ones from the old form cannot be: those
          files need a Google sign-in, so they stay as links. */}
      <div className="flex flex-wrap items-start gap-3">
        {group.receipts.map((receipt) => {
          const src =
            receipt.storageId !== undefined
              ? (fileUrls[receipt.storageId] ?? undefined)
              : undefined;
          const previewable = src !== undefined && isImage(receipt.fileName);

          return (
            <div key={receipt.label} className="flex flex-col gap-1">
              {previewable ? (
                <button
                  type="button"
                  onClick={() => onZoom(src, receipt.label)}
                  title="Click to enlarge"
                  className="block overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-cg-purple-soft"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Receipt for ${receipt.label}`}
                    className="h-28 w-40 object-cover"
                    loading="lazy"
                  />
                </button>
              ) : (
                <div className="flex h-28 w-40 items-center justify-center rounded-xl border border-line bg-surface px-3 text-center">
                  <span className="text-[12px] leading-snug text-muted">
                    {receipt.url !== undefined
                      ? "Kept in Google Drive"
                      : src !== undefined
                        ? "PDF receipt"
                        : "No receipt"}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[12.5px]">
                <button
                  type="button"
                  onClick={() => onOpen(receipt.registrationId)}
                  className="font-medium text-cg-purple hover:underline"
                >
                  {receipt.label}
                </button>
                {(receipt.url ?? src) !== undefined && (
                  <a
                    href={receipt.url ?? src}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted hover:text-cg-purple hover:underline"
                  >
                    open ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form
        noValidate
        className="flex flex-wrap items-end gap-3 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          save("received");
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">
            Amount received
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={group.expectedKnown ? String(group.expected) : "0"}
            className="no-spinner h-10 w-36 rounded-[10px] border border-line bg-white px-3 text-[14px] text-ink"
          />
        </label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Note</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Short, partial, paid in cash…"
            className="h-10 w-full rounded-[10px] border border-line bg-white px-3 text-[14px] text-ink"
          />
        </label>
        <Button
          type="submit"
          size="sm"
          loading={busy}
          disabled={amount.trim().length === 0}
        >
          {reconciled ? "Update" : "Mark received"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => save("unpaid")}
        >
          Not paid yet
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => save("problem")}
          title="Keeps whatever amount is in the box — use it for part-payments"
        >
          Short or wrong
        </Button>
        {status !== undefined && (
          <Button
            type="button"
            size="sm"
            variant="quiet"
            onClick={() => void clear({ reference: group.reference })}
          >
            Clear
          </Button>
        )}
      </form>

      {error !== null && <Callout tone="error">{error}</Callout>}

      {status !== undefined && status !== "received" && (
        <p className="text-[13px] text-muted">
          {STATUS_LABEL[status]}
          {group.record!.amountReceived > 0
            ? ` — ${formatPeso(group.record!.amountReceived)} received so far`
            : ""}{" "}
          — marked by {group.record!.verifiedByEmail}
          {group.record!.note ? ` · ${group.record!.note}` : ""}
        </p>
      )}

      {reconciled && (
        <p className="text-[13px] text-muted">
          {formatPeso(group.record!.amountReceived)} recorded by{" "}
          {group.record!.verifiedByEmail}
          {mismatch && (
            <span className="ml-1.5 font-semibold text-cg-gold-ink">
              — {formatPeso(Math.abs(group.record!.amountReceived - group.expected))}{" "}
              {group.record!.amountReceived > group.expected ? "over" : "short"}
            </span>
          )}
        </p>
      )}
    </li>
  );
}

export function PaymentsSection({
  rows,
  payments,
  onOpen,
}: {
  rows: Row[];
  payments: Payment[];
  onOpen: (registrationId: Id<"registrations">) => void;
}) {
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null);
  const groups = useMemo(() => buildGroups(rows, payments), [rows, payments]);

  // Signed URLs are resolved once for every uploaded receipt on the page.
  const storageIds = useMemo(
    () =>
      rows
        .map((r) => r.registration.paymentProofStorageId)
        .filter((id): id is Id<"_storage"> => id !== undefined),
    [rows],
  );
  const fileUrls =
    useQuery(
      api.organizer.paymentProofUrls,
      storageIds.length > 0 ? { storageIds } : "skip",
    ) ?? {};

  // Part-payments count towards what has actually arrived.
  const received = groups.reduce(
    (sum, g) =>
      statusOf(g.record) === "unpaid" ? sum : sum + (g.record?.amountReceived ?? 0),
    0,
  );
  const unpaid = groups.filter((g) => statusOf(g.record) === "unpaid");
  const problems = groups.filter((g) => statusOf(g.record) === "problem");
  const expectedKnown = groups
    .filter((g) => g.expectedKnown)
    .reduce((sum, g) => sum + g.expected, 0);
  // Unchecked means nobody has said anything about it yet. A deposit marked
  // "not paid yet" or "needs sorting" has been looked at, and belongs in its
  // own pile rather than back in the queue.
  const outstanding = groups.filter((g) => g.record === undefined);
  const shown = onlyOutstanding ? outstanding : groups;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Confirmed received"
          value={formatPeso(received)}
          note={`${groups.length - outstanding.length} of ${groups.length} references checked`}
        />
        <StatTile
          label="Expected, where known"
          value={formatPeso(expectedKnown)}
          note="excludes imported rows with no amount"
        />
        <StatTile
          label="Still to check"
          tone="warn"
          value={String(outstanding.length)}
          note={
            unpaid.length + problems.length > 0
              ? `plus ${unpaid.length} not paid yet, ${problems.length} needing sorting`
              : "references nobody has looked at yet"
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] leading-relaxed text-muted">
          Grouped by payment reference, because one deposit often covers several
          people. Open each receipt, check it against the bank, and record what
          actually arrived.
        </p>
        <Button
          size="sm"
          variant={onlyOutstanding ? "primary" : "outline"}
          onClick={() => setOnlyOutstanding((v) => !v)}
        >
          {onlyOutstanding ? "Showing unchecked" : "Show unchecked only"}
        </Button>
      </div>

      {zoom !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Receipt for ${zoom.label}`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/80 p-6"
          onClick={() => setZoom(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom.src}
            alt={`Receipt for ${zoom.label}`}
            className="max-h-[85vh] max-w-full rounded-xl bg-white object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-4 text-[14px] text-white">
            <span className="font-semibold">{zoom.label}</span>
            <a
              href={zoom.src}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              Open full size
            </a>
            <span className="text-white/60">Click anywhere to close</span>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white py-16 text-center text-[15px] text-muted">
          {onlyOutstanding
            ? "Every reference has been checked."
            : "No payments to reconcile yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((group) => (
            <GroupCard
              key={group.reference}
              group={group}
              onOpen={onOpen}
              fileUrls={fileUrls}
              onZoom={(src, label) => setZoom({ src, label })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}


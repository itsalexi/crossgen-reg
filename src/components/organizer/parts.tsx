"use client";

import type { ReactNode } from "react";
import { Eyebrow, Pill, cn } from "@/components/ui";
import { receiptMissing, type Registration } from "@/lib/organizer";

export function StatTile({
  label,
  value,
  note,
  tone = "ink",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "ink" | "warn";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-line bg-white px-5 py-4">
      <Eyebrow>{label}</Eyebrow>
      <span
        className={cn(
          "font-display text-[28px] leading-none font-bold tracking-[-0.025em]",
          tone === "warn" && value !== "0" ? "text-cg-gold-ink" : "text-ink",
        )}
      >
        {value}
      </span>
      {note && (
        <span className="text-[13px] leading-normal text-muted">{note}</span>
      )}
    </div>
  );
}

/** Ranked counts with a proportional bar — sessions, churches, cities. */
export function BarList({
  items,
  total,
  empty = "Nothing yet.",
  max = 8,
}: {
  items: { name: string; count: number }[];
  total: number;
  empty?: string;
  max?: number;
}) {
  if (items.length === 0) {
    return <p className="py-3 text-[14px] text-muted">{empty}</p>;
  }

  const top = items.slice(0, max);
  const peak = Math.max(...top.map((i) => i.count), 1);

  return (
    <ul className="flex min-w-0 flex-col">
      {top.map((item) => (
        <li key={item.name} className="flex min-w-0 flex-col gap-1.5 py-2.5">
          <div className="flex min-w-0 items-baseline justify-between gap-4">
            <span className="min-w-0 truncate text-[14px] text-ink">{item.name}</span>
            <span className="flex-none text-[13px] text-muted">
              {item.count}
              {total > 0 && (
                <span className="ml-1.5 text-faint">
                  {Math.round((item.count / total) * 100)}%
                </span>
              )}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-1.5 rounded-full bg-cg-purple-soft"
              style={{ width: `${(item.count / peak) * 100}%` }}
            />
          </div>
        </li>
      ))}
      {items.length > max && (
        <li className="pt-2 text-[13px] text-muted">
          + {items.length - max} more
        </li>
      )}
    </ul>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("min-w-0 rounded-2xl border border-line bg-white p-5", className)}
    >
      <div className="flex items-baseline justify-between gap-4 pb-1">
        <Eyebrow>{title}</Eyebrow>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ReceiptTag({ registration }: { registration: Registration }) {
  if (registration.paymentType === "exempt") {
    return <span className="text-[13px] text-muted">Not needed</span>;
  }
  if (registration.paymentProofExternalUrl !== undefined) {
    return <Pill tone="teal">On Drive</Pill>;
  }
  return receiptMissing(registration) ? (
    <Pill tone="gold">Missing</Pill>
  ) : (
    <Pill tone="teal">Attached</Pill>
  );
}

/** Marks the rows that came from the original Google Form. */
export function SourceTag({ registration }: { registration: Registration }) {
  if (registration.source !== "google-form") return null;
  return <Pill tone="muted">Google Form</Pill>;
}

export function amountText(registration: Registration): string {
  return registration.amountUnknown === true
    ? "—"
    : `₱${registration.totalAmount.toLocaleString("en-PH")}`;
}

export function EmailTag({ registration }: { registration: Registration }) {
  const status = registration.confirmationEmailStatus;
  if (status === "sent") return <span className="text-[13px] text-muted">Sent</span>;
  if (status === "pending") return <Pill tone="purple">Sending</Pill>;
  return <Pill tone="gold">Failed</Pill>;
}

export function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

export function longDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

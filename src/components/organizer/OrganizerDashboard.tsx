"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import {
  BREAKOUT_SESSIONS,
  breakoutTitle,
  formatDatePaid,
  formatPeso,
  REGISTRATION_TYPES,
  typeShort,
  type RegistrationType,
} from "@convex/shared";
import { buildParticipantCsv, downloadCsv } from "@/lib/csv";
import { AccountBar, BottomBar, TopBar } from "@/components/brand";
import { Button, Eyebrow, Pill, Spinner, cn } from "@/components/ui";

type Row = {
  registration: Doc<"registrations">;
  participants: Doc<"participants">[];
};

const COLUMNS =
  "grid grid-cols-[110px_1.3fr_56px_1fr_92px_100px_88px] gap-4 items-center";

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function longDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dayStart(value: string): number | undefined {
  if (value.length === 0) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function dayEnd(value: string): number | undefined {
  if (value.length === 0) return undefined;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function isImage(name: string | undefined): boolean {
  return /\.(jpe?g|png)$/i.test(name ?? "");
}

function ReceiptTag({ registration }: { registration: Doc<"registrations"> }) {
  if (registration.paymentType === "exempt") {
    return <span className="text-[13.5px] text-muted">Not needed</span>;
  }
  return registration.paymentProofStorageId ? (
    <Pill tone="teal">Attached</Pill>
  ) : (
    <Pill tone="gold">Missing</Pill>
  );
}

// ------------------------------------------------------------ detail panel

function Detail({
  registrationId,
  onBack,
}: {
  registrationId: Id<"registrations">;
  onBack: () => void;
}) {
  const detail = useQuery(api.organizer.get, { registrationId });
  const resend = useMutation(api.organizer.resendConfirmation);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  if (detail === undefined) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-5 text-cg-purple" />
      </div>
    );
  }
  if (detail === null) return null;

  const { registration, participants, paymentProofUrl } = detail;
  const shared =
    participants.length > 1 &&
    participants.every(
      (p) =>
        p.churchOrganization === participants[0].churchOrganization &&
        p.cityMunicipality === participants[0].cityMunicipality,
    );

  return (
    <div>
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-5 sm:px-8">
        <button
          type="button"
          onClick={onBack}
          className="text-[13.5px] font-medium text-cg-purple hover:underline"
        >
          All registrations
        </button>
        <span className="text-[13.5px] text-faint">/</span>
        <span className="text-[13.5px] font-medium text-muted">
          {registration.registrationNumber}
        </span>
      </div>

      <div className="flex flex-col justify-between gap-5 border-b border-line px-5 py-7 sm:flex-row sm:items-start sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[26px] leading-tight font-semibold text-ink sm:text-[30px]">
            {registration.groupName ?? registration.registrantName}
          </h1>
          <span className="text-[15px] leading-normal text-muted">
            {registration.registrationNumber} · registered{" "}
            {longDate(registration._creationTime)} by{" "}
            {registration.registrantEmail}
          </span>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            loading={resending}
            onClick={() => {
              setResending(true);
              void resend({ registrationId })
                .then(() => setResent(true))
                .finally(() => setResending(false));
            }}
          >
            {resent ? "Sent again" : "Resend email"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv(
                `${registration.registrationNumber}.csv`,
                buildParticipantCsv([{ registration, participants }]),
              )
            }
          >
            Export this group
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-5 border-b border-line px-5 py-6 sm:grid-cols-4 sm:gap-0 sm:px-8">
        {[
          ["Type", typeShort(registration.registrationType as RegistrationType)],
          ["People", String(registration.participantCount)],
          ["Amount", formatPeso(registration.totalAmount)],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={cn(
              "flex flex-col gap-1",
              index > 0 && "sm:border-l sm:border-line sm:px-7",
              index === 0 && "sm:pr-7",
            )}
          >
            <Eyebrow>{label}</Eyebrow>
            <dd className="font-display text-[16px] font-semibold text-ink">
              {value}
            </dd>
          </div>
        ))}
        <div className="flex flex-col gap-1 sm:border-l sm:border-line sm:pl-7">
          <Eyebrow>Receipt</Eyebrow>
          <dd>
            <ReceiptTag registration={registration} />
          </dd>
        </div>
      </dl>

      <div className="grid gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="flex flex-col">
          <Eyebrow>Participants</Eyebrow>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-y border-line text-[11.5px] font-semibold tracking-[0.07em] text-muted uppercase">
                  <th className="py-3 pr-4 font-semibold">Name</th>
                  <th className="py-3 pr-4 font-semibold">Age</th>
                  <th className="py-3 pr-4 font-semibold">Mobile</th>
                  <th className="py-3 font-semibold">Session</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr
                    key={p._id}
                    className="border-b border-line-soft align-baseline text-[14.5px]"
                  >
                    <td className="py-3.5 pr-4 font-medium text-ink">
                      {p.fullName}
                      {p.preferredName && (
                        <span className="ml-1 font-normal text-muted">
                          ({p.preferredName})
                        </span>
                      )}
                      {!shared && (
                        <div className="text-[13px] text-muted">
                          {p.churchOrganization} · {p.cityMunicipality}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-muted">{p.age}</td>
                    <td className="py-3.5 pr-4 text-muted">
                      {p.mobileNumber}
                      <div className="text-[13px]">{p.email}</div>
                    </td>
                    <td className="py-3.5 text-muted">
                      {breakoutTitle(p.breakoutSession)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shared && (
            <p className="pt-3.5 text-[13.5px] leading-normal text-muted">
              Everyone lists {participants[0].churchOrganization},{" "}
              {participants[0].cityMunicipality}.
            </p>
          )}
          {registration.confirmationEmailStatus === "failed" && (
            <p className="pt-3 text-[13px] leading-normal text-red-600">
              Confirmation email failed: {registration.confirmationEmailError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Eyebrow>Receipt</Eyebrow>
          {registration.paymentType === "exempt" ? (
            <p className="text-[14px] leading-normal text-muted">
              Exempt — {registration.exemptionReason}. Nothing was collected.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line">
              {/* Most receipts are phone photos, so show one. PDFs fall back
                  to the filename — organizers open those in a new tab. */}
              {paymentProofUrl !== null && isImage(registration.paymentProofFileName) ? (
                <a href={paymentProofUrl} target="_blank" rel="noreferrer">
                  <img
                    src={paymentProofUrl}
                    alt={`Receipt for ${registration.registrationNumber}`}
                    className="h-44 w-full bg-surface object-contain"
                  />
                </a>
              ) : (
                <div className="flex h-44 items-center justify-center bg-surface px-4 text-center">
                  <span className="text-[13.5px] leading-normal text-muted">
                    {registration.paymentProofFileName ?? "Receipt"}
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-2.5 border-t border-line px-4 py-3.5">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[13.5px] leading-normal">
                  <dt className="text-muted">Reference</dt>
                  <dd className="font-medium">{registration.paymentReference}</dd>
                  <dt className="text-muted">Paid</dt>
                  <dd className="font-medium">
                    {formatDatePaid(registration.datePaid ?? "")}
                  </dd>
                </dl>
                {paymentProofUrl !== null ? (
                  <a
                    href={paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9.5 items-center justify-center rounded-[10px] border border-line bg-white text-[14px] font-semibold text-cg-purple hover:border-cg-purple-soft hover:bg-cg-purple-tint"
                  >
                    Open full size
                  </a>
                ) : (
                  <span className="text-[13.5px] text-muted">
                    No file attached.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the list

export function OrganizerDashboard() {
  const [search, setSearch] = useState("");
  const [registrationType, setRegistrationType] = useState("");
  const [breakoutSession, setBreakoutSession] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState<Id<"registrations"> | null>(null);

  const isOrganizer = useQuery(api.organizer.amIOrganizer);
  const data = useQuery(
    api.organizer.list,
    isOrganizer === true
      ? {
          search: search.trim().length > 0 ? search.trim() : undefined,
          registrationType:
            registrationType.length > 0
              ? (registrationType as RegistrationType)
              : undefined,
          breakoutSession:
            breakoutSession.length > 0
              ? (Number(breakoutSession) as 1 | 2 | 3 | 4 | 5)
              : undefined,
          dateFrom: dayStart(dateFrom),
          dateTo: dayEnd(dateTo),
        }
      : "skip",
  );

  const stats = useMemo(() => {
    if (data === undefined) return null;
    const rows: Row[] = data.rows;

    const exemptPeople = rows
      .filter((r) => r.registration.paymentType === "exempt")
      .reduce((sum, r) => sum + r.registration.participantCount, 0);

    const missingReceipts = rows.filter(
      (r) =>
        r.registration.paymentType === "paid" &&
        r.registration.paymentProofStorageId === undefined,
    ).length;

    const bySession = new Map<number, number>();
    for (const row of rows) {
      for (const p of row.participants) {
        bySession.set(p.breakoutSession, (bySession.get(p.breakoutSession) ?? 0) + 1);
      }
    }
    const fullest = [...bySession.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      exemptPeople,
      missingReceipts,
      withReceipts: rows.filter(
        (r) => r.registration.paymentProofStorageId !== undefined,
      ).length,
      fullest,
    };
  }, [data]);

  const filtersOn =
    search.length > 0 ||
    registrationType.length > 0 ||
    breakoutSession.length > 0 ||
    dateFrom.length > 0 ||
    dateTo.length > 0;

  const selectClass =
    "h-10 rounded-[10px] border border-line bg-white px-3 text-[14.5px] text-ink";

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar href="/organizer" right={<AccountBar />} />

      <main className="flex-1">
        <AuthLoading>
          <div className="flex justify-center py-24">
            <Spinner className="size-6 text-cg-purple" />
          </div>
        </AuthLoading>

        <Unauthenticated>
          <div className="mx-auto max-w-md px-5 py-20">
            <h1 className="font-display text-[26px] font-semibold text-ink">
              Organizers only
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Sign in with an organizer account to see the registrations.
            </p>
          </div>
        </Unauthenticated>

        <Authenticated>
          {isOrganizer === undefined ? (
            <div className="flex justify-center py-24">
              <Spinner className="size-6 text-cg-purple" />
            </div>
          ) : isOrganizer === false ? (
            <div className="mx-auto max-w-md px-5 py-20">
              <h1 className="font-display text-[26px] font-semibold text-ink">
                Not on the organizer list
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                Ask the CrossGen team to add your email address, then reload this
                page.
              </p>
            </div>
          ) : open !== null ? (
            <Detail registrationId={open} onBack={() => setOpen(null)} />
          ) : (
            <>
              {/* ----------------------------------------------- the numbers */}
              <dl className="grid grid-cols-2 gap-6 border-b border-line px-5 py-7 sm:px-8 lg:grid-cols-4 lg:gap-0">
                {[
                  {
                    label: "Participants",
                    value: data ? String(data.totals.participants) : "—",
                    note: data
                      ? `across ${data.totals.registrations} registration${data.totals.registrations === 1 ? "" : "s"}`
                      : "",
                  },
                  {
                    label: "Received",
                    value: data ? formatPeso(data.totals.amount) : "—",
                    note: stats
                      ? `${stats.withReceipts} with receipts attached`
                      : "",
                  },
                  {
                    label: "Not paying",
                    value: stats ? String(stats.exemptPeople) : "—",
                    note: "speakers, volunteers, sponsors",
                  },
                  {
                    label: "Fullest session",
                    value: stats?.fullest ? String(stats.fullest[1]) : "—",
                    note: stats?.fullest
                      ? breakoutTitle(stats.fullest[0]).split(":")[0]
                      : "no sessions yet",
                  },
                ].map((stat, index) => (
                  <div
                    key={stat.label}
                    className={cn(
                      "flex flex-col gap-1.5",
                      index > 0 && "lg:border-l lg:border-line lg:px-8",
                      index === 0 && "lg:pr-8",
                    )}
                  >
                    <Eyebrow>{stat.label}</Eyebrow>
                    <span className="font-display text-[30px] leading-none font-bold tracking-[-0.025em] text-ink sm:text-[34px]">
                      {stat.value}
                    </span>
                    <span className="text-[13.5px] leading-normal text-muted">
                      {stat.note}
                    </span>
                  </div>
                ))}
              </dl>

              {/* ----------------------------------------------- the filters */}
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 sm:px-8">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search a name, group, or number"
                  aria-label="Search registrations"
                  className="h-10 w-full min-w-[200px] flex-1 rounded-[10px] border border-line bg-white px-3.5 text-[14.5px] text-ink placeholder:text-faint sm:max-w-[340px]"
                />
                <select
                  aria-label="Registration type"
                  className={selectClass}
                  value={registrationType}
                  onChange={(e) => setRegistrationType(e.target.value)}
                >
                  <option value="">All types</option>
                  {REGISTRATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.short}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Breakout session"
                  className={selectClass}
                  value={breakoutSession}
                  onChange={(e) => setBreakoutSession(e.target.value)}
                >
                  <option value="">All sessions</option>
                  {BREAKOUT_SESSIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.title.split(":")[0]}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  aria-label="Registered from"
                  className={selectClass}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <input
                  type="date"
                  aria-label="Registered to"
                  className={selectClass}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
                {stats !== null && stats.missingReceipts > 0 && (
                  <Pill tone="purple">
                    Receipt missing · {stats.missingReceipts}
                  </Pill>
                )}
                <div className="ml-auto flex items-center gap-4">
                  <span className="text-[13.5px] text-muted">
                    {data
                      ? `${data.totals.registrations}${filtersOn ? ` of ${data.totals.allRegistrations}` : ""} registration${data.totals.registrations === 1 ? "" : "s"}`
                      : "Loading…"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={data === undefined || data.rows.length === 0}
                    onClick={() => {
                      if (data === undefined) return;
                      downloadCsv(
                        "crossgen-2026-participants.csv",
                        buildParticipantCsv(data.rows),
                      );
                    }}
                  >
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* ------------------------------------------------- the table */}
              <div className="px-5 pb-10 sm:px-8">
                {data === undefined ? (
                  <div className="flex justify-center py-20">
                    <Spinner className="size-6 text-cg-purple" />
                  </div>
                ) : data.rows.length === 0 ? (
                  <p className="py-16 text-center text-[15px] text-muted">
                    {filtersOn
                      ? "Nothing matches those filters."
                      : "No registrations yet. The first one will show up here."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[880px]">
                      <div
                        className={cn(
                          COLUMNS,
                          "border-b border-line py-3.5 text-[11.5px] font-semibold tracking-[0.07em] text-muted uppercase",
                        )}
                      >
                        <span>Number</span>
                        <span>Group</span>
                        <span>People</span>
                        <span>Registered by</span>
                        <span>Type</span>
                        <span>Amount</span>
                        <span>Receipt</span>
                      </div>

                      {data.rows.map(({ registration }) => {
                        const missing =
                          registration.paymentType === "paid" &&
                          registration.paymentProofStorageId === undefined;

                        return (
                          <button
                            key={registration._id}
                            type="button"
                            onClick={() => setOpen(registration._id)}
                            className={cn(
                              COLUMNS,
                              "w-full border-b border-line-soft py-4 text-left text-[14.5px] text-ink transition-colors hover:bg-surface",
                              missing && "bg-[#fffdf5]",
                            )}
                          >
                            <span className="font-semibold">
                              {registration.registrationNumber}
                            </span>
                            <span className="truncate font-medium">
                              {registration.groupName ?? (
                                <span className="text-muted">—</span>
                              )}
                              <span className="block text-[12.5px] font-normal text-muted">
                                {shortDate(registration._creationTime)}
                              </span>
                            </span>
                            <span>{registration.participantCount}</span>
                            <span className="truncate text-muted">
                              {registration.registrantEmail}
                            </span>
                            <span>
                              {typeShort(
                                registration.registrationType as RegistrationType,
                              )}
                            </span>
                            <span
                              className={cn(
                                registration.totalAmount === 0
                                  ? "text-muted"
                                  : "font-medium",
                              )}
                            >
                              {formatPeso(registration.totalAmount)}
                            </span>
                            <span className="justify-self-start">
                              <ReceiptTag registration={registration} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Authenticated>
      </main>

      <BottomBar />
    </div>
  );
}

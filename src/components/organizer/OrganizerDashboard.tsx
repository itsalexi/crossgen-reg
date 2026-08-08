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
import type { Id } from "@convex/_generated/dataModel";
import {
  BREAKOUT_SESSIONS,
  breakoutTitle,
  formatPeso,
  REGISTRATION_TYPES,
  typeShort,
  type RegistrationType,
} from "@convex/shared";
import { AccountBar, BottomBar, TopBar } from "@/components/brand";
import { Button, Eyebrow, Spinner, cn } from "@/components/ui";
import { buildParticipantCsv, downloadCsv } from "@/lib/csv";
import {
  buildRows,
  computeStats,
  EMPTY_FILTERS,
  filterRows,
  filtersActive,
  uniqueValues,
  type Filters,
} from "@/lib/organizer";
import { AdminsSection } from "./AdminsSection";
import { RegistrationDetail } from "./RegistrationDetail";
import { BarList, EmailTag, Panel, ReceiptTag, shortDate, StatTile } from "./parts";

type Section = "overview" | "registrations" | "people" | "admins";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "registrations", label: "Registrations" },
  { key: "people", label: "Participants" },
  { key: "admins", label: "Organizers" },
];

const CONTROL =
  "h-10 w-full min-w-0 rounded-[10px] border border-line bg-white px-3 text-[14px] text-ink";

// Between the rail and the table there is only ~820px at 1180px wide, which is
// less than these tables want. Rather than an inner scrollbar, the columns that
// are recoverable from the detail view drop out until there is room.
const WIDE_ONLY = "hidden xl:table-cell";

export function OrganizerDashboard() {
  const [section, setSection] = useState<Section>("overview");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [open, setOpen] = useState<Id<"registrations"> | null>(null);
  const [resending, setResending] = useState(false);

  const isOrganizer = useQuery(api.organizer.amIOrganizer);
  const data = useQuery(api.organizer.snapshot, isOrganizer === true ? {} : "skip");
  const resendAllFailed = useMutation(api.organizer.resendAllFailed);

  const allRows = useMemo(
    () => (data ? buildRows(data.registrations, data.participants) : []),
    [data],
  );
  const rows = useMemo(() => filterRows(allRows, filters), [allRows, filters]);
  const people = useMemo(
    () => rows.flatMap((row) =>
      row.participants.map((participant) => ({ participant, registration: row.registration })),
    ),
    [rows],
  );
  const stats = useMemo(() => computeStats(rows), [rows]);
  const allStats = useMemo(() => computeStats(allRows), [allRows]);
  const churches = useMemo(
    () => uniqueValues(allRows, (p) => p.churchOrganization),
    [allRows],
  );
  const cities = useMemo(
    () => uniqueValues(allRows, (p) => p.cityMunicipality),
    [allRows],
  );

  const active = filtersActive(filters);
  const set = (patch: Partial<Filters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar href="/organizer" right={<AccountBar />} />

      <AuthLoading>
        <div className="flex flex-1 items-center justify-center py-24">
          <Spinner className="size-6 text-cg-purple" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <main className="mx-auto w-full max-w-md flex-1 px-5 py-20">
          <h1 className="font-display text-[26px] font-semibold text-ink">
            Organizers only
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Sign in with an organizer account to see the registrations.
          </p>
        </main>
      </Unauthenticated>

      <Authenticated>
        {isOrganizer === undefined ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <Spinner className="size-6 text-cg-purple" />
          </div>
        ) : isOrganizer === false ? (
          <main className="mx-auto w-full max-w-md flex-1 px-5 py-20">
            <h1 className="font-display text-[26px] font-semibold text-ink">
              Not on the organizer list
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Ask someone already on the team to add your email address, then
              reload this page.
            </p>
          </main>
        ) : (
          <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:px-8">
            {/* --------------------------------------------------- left rail */}
            <aside className="flex w-full flex-none flex-col gap-5 lg:sticky lg:top-6 lg:h-fit lg:w-[264px]">
              <nav className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 lg:flex-col lg:overflow-visible">
                {SECTIONS.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => {
                      setSection(entry.key);
                      setOpen(null);
                    }}
                    className={cn(
                      "flex-none rounded-lg px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors lg:w-full",
                      section === entry.key
                        ? "bg-cg-purple-tint text-cg-purple"
                        : "text-muted hover:bg-surface hover:text-ink",
                    )}
                  >
                    {entry.label}
                  </button>
                ))}
              </nav>

              {section !== "admins" && (
                <>
                  <div className="flex flex-col gap-1 rounded-xl border border-line bg-white px-4 py-3.5">
                    <Eyebrow>{active ? "Matching now" : "All registrations"}</Eyebrow>
                    <p className="font-display text-[22px] leading-tight font-bold text-ink">
                      {stats.participants}
                      <span className="ml-1.5 text-[13px] font-medium text-muted">
                        people
                      </span>
                    </p>
                    <p className="text-[13px] text-muted">
                      {stats.registrations} registration
                      {stats.registrations === 1 ? "" : "s"} ·{" "}
                      {formatPeso(stats.amount)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
                    <div className="flex items-baseline justify-between">
                      <Eyebrow>Filters</Eyebrow>
                      {active && (
                        <button
                          type="button"
                          onClick={() => setFilters(EMPTY_FILTERS)}
                          className="text-[13px] font-semibold text-cg-purple hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <input
                      type="search"
                      className={CONTROL}
                      placeholder="Name, group, number, email"
                      aria-label="Search"
                      value={filters.search}
                      onChange={(e) => set({ search: e.target.value })}
                    />
                    <select
                      className={CONTROL}
                      aria-label="Registration type"
                      value={filters.type}
                      onChange={(e) => set({ type: e.target.value as Filters["type"] })}
                    >
                      <option value="">All types</option>
                      {REGISTRATION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.short}
                        </option>
                      ))}
                    </select>
                    <select
                      className={CONTROL}
                      aria-label="Breakout session"
                      value={filters.session}
                      onChange={(e) =>
                        set({
                          session: e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                    >
                      <option value="">All sessions</option>
                      {BREAKOUT_SESSIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.value}. {s.title.split(":")[0]}
                        </option>
                      ))}
                    </select>
                    <select
                      className={CONTROL}
                      aria-label="Payment"
                      value={filters.payment}
                      onChange={(e) =>
                        set({ payment: e.target.value as Filters["payment"] })
                      }
                    >
                      <option value="">Any payment</option>
                      <option value="paid">Paying</option>
                      <option value="exempt">Not paying</option>
                      <option value="receipt-missing">Receipt missing</option>
                    </select>
                    <select
                      className={CONTROL}
                      aria-label="Confirmation email"
                      value={filters.email}
                      onChange={(e) =>
                        set({ email: e.target.value as Filters["email"] })
                      }
                    >
                      <option value="">Any email status</option>
                      <option value="sent">Email sent</option>
                      <option value="pending">Email sending</option>
                      <option value="failed">Email failed</option>
                    </select>
                    <select
                      className={CONTROL}
                      aria-label="Church"
                      value={filters.church}
                      onChange={(e) => set({ church: e.target.value })}
                    >
                      <option value="">All churches</option>
                      {churches.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      className={CONTROL}
                      aria-label="City"
                      value={filters.city}
                      onChange={(e) => set({ city: e.target.value })}
                    >
                      <option value="">All cities</option>
                      {cities.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        className={CONTROL}
                        aria-label="Registered from"
                        value={filters.dateFrom}
                        onChange={(e) => set({ dateFrom: e.target.value })}
                      />
                      <input
                        type="date"
                        className={CONTROL}
                        aria-label="Registered to"
                        value={filters.dateTo}
                        onChange={(e) => set({ dateTo: e.target.value })}
                      />
                    </div>
                  </div>

                  {allStats.receiptsMissing + allStats.emailsFailed > 0 && (
                    <div className="flex flex-col gap-2 rounded-xl border border-cg-gold/40 bg-cg-gold-tint p-4">
                      <Eyebrow>Needs a look</Eyebrow>
                      {allStats.receiptsMissing > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            set({ payment: "receipt-missing" });
                            setSection("registrations");
                          }}
                          className="text-left text-[14px] font-medium text-cg-gold-ink hover:underline"
                        >
                          {allStats.receiptsMissing} without a receipt
                        </button>
                      )}
                      {allStats.emailsFailed > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            set({ email: "failed" });
                            setSection("registrations");
                          }}
                          className="text-left text-[14px] font-medium text-cg-gold-ink hover:underline"
                        >
                          {allStats.emailsFailed} email
                          {allStats.emailsFailed === 1 ? "" : "s"} failed
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </aside>

            {/* -------------------------------------------------- main column */}
            <div className="min-w-0 flex-1">
              {data === undefined ? (
                <div className="flex justify-center py-24">
                  <Spinner className="size-6 text-cg-purple" />
                </div>
              ) : open !== null ? (
                <RegistrationDetail registrationId={open} onBack={() => setOpen(null)} />
              ) : section === "admins" ? (
                <AdminsSection />
              ) : section === "overview" ? (
                <div className="flex flex-col gap-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatTile
                      label="Participants"
                      value={String(stats.participants)}
                      note={`across ${stats.registrations} registration${stats.registrations === 1 ? "" : "s"}`}
                    />
                    <StatTile
                      label="Collected"
                      value={formatPeso(stats.amount)}
                      note={`${stats.receiptsAttached} receipt${stats.receiptsAttached === 1 ? "" : "s"} attached`}
                    />
                    <StatTile
                      label="Not paying"
                      value={String(stats.exemptParticipants)}
                      note="speakers, volunteers, sponsors"
                    />
                    <StatTile
                      label="Needs a receipt"
                      tone="warn"
                      value={String(stats.receiptsMissing)}
                      note={
                        stats.emailsFailed > 0
                          ? `${stats.emailsFailed} email${stats.emailsFailed === 1 ? "" : "s"} also failed`
                          : "everything else is in"
                      }
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Panel title="Breakout sessions">
                      <BarList
                        total={stats.participants}
                        items={stats.bySession.map((s) => ({
                          name: `${s.value}. ${s.title.split(":")[0]}`,
                          count: s.count,
                        }))}
                      />
                    </Panel>
                    <Panel title="Who's coming">
                      <BarList
                        total={stats.participants}
                        items={stats.byType.map((t) => ({
                          name: typeShort(t.type),
                          count: t.count,
                        }))}
                      />
                      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[14px]">
                        <div>
                          <dt className="text-muted">Average age</dt>
                          <dd className="font-semibold text-ink">
                            {stats.averageAge ?? "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Under 18</dt>
                          <dd className="font-semibold text-ink">{stats.minors}</dd>
                        </div>
                      </dl>
                    </Panel>
                    <Panel title="Churches">
                      <BarList items={stats.byChurch} total={stats.participants} />
                    </Panel>
                    <Panel title="Cities">
                      <BarList items={stats.byCity} total={stats.participants} />
                    </Panel>
                  </div>

                  {stats.emailsFailed > 0 && (
                    <Panel
                      title="Confirmation emails that failed"
                      action={
                        <Button
                          size="sm"
                          variant="outline"
                          loading={resending}
                          onClick={() => {
                            setResending(true);
                            void resendAllFailed().finally(() => setResending(false));
                          }}
                        >
                          Retry all
                        </Button>
                      }
                    >
                      <ul className="flex flex-col">
                        {rows
                          .filter(
                            (r) => r.registration.confirmationEmailStatus === "failed",
                          )
                          .map(({ registration }) => (
                            <li
                              key={registration._id}
                              className="border-t border-line py-2.5 text-[14px]"
                            >
                              <button
                                type="button"
                                onClick={() => setOpen(registration._id)}
                                className="font-semibold text-cg-purple hover:underline"
                              >
                                {registration.registrationNumber}
                              </button>
                              <span className="ml-2 text-muted">
                                {registration.registrantEmail}
                              </span>
                              {registration.confirmationEmailError && (
                                <div className="text-[12.5px] text-red-600">
                                  {registration.confirmationEmailError}
                                </div>
                              )}
                            </li>
                          ))}
                      </ul>
                    </Panel>
                  )}
                </div>
              ) : section === "registrations" ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="font-display text-[22px] font-semibold text-ink">
                      {stats.registrations} registration
                      {stats.registrations === 1 ? "" : "s"}
                      {active && (
                        <span className="ml-2 text-[14px] font-normal text-muted">
                          of {allStats.registrations}
                        </span>
                      )}
                    </h1>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rows.length === 0}
                      onClick={() =>
                        downloadCsv(
                          "crossgen-2026-participants.csv",
                          buildParticipantCsv(rows),
                        )
                      }
                    >
                      Export CSV
                    </Button>
                  </div>

                  {rows.length === 0 ? (
                    <p className="rounded-2xl border border-line bg-white py-16 text-center text-[15px] text-muted">
                      {active
                        ? "Nothing matches those filters."
                        : "No registrations yet."}
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                      <table className="w-full min-w-[620px] text-left">
                        <thead>
                          <tr className="border-b border-line text-[11.5px] font-semibold tracking-[0.07em] text-muted uppercase">
                            <th className="px-4 py-3 font-semibold">Number</th>
                            <th className="px-4 py-3 font-semibold">Group</th>
                            <th className="px-4 py-3 font-semibold">People</th>
                            <th className={`px-4 py-3 font-semibold ${WIDE_ONLY}`}>
                              Registered by
                            </th>
                            <th className="px-4 py-3 font-semibold">Type</th>
                            <th className="px-4 py-3 font-semibold">Amount</th>
                            <th className="px-4 py-3 font-semibold">Receipt</th>
                            <th className={`px-4 py-3 font-semibold ${WIDE_ONLY}`}>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ registration, participants }) => (
                            <tr
                              key={registration._id}
                              onClick={() => setOpen(registration._id)}
                              className="cursor-pointer border-b border-line-soft text-[14px] last:border-0 hover:bg-surface"
                            >
                              <td className="px-4 py-3.5 font-semibold text-cg-purple">
                                {registration.registrationNumber}
                                <div className="text-[12.5px] font-normal text-muted">
                                  {shortDate(registration._creationTime)}
                                </div>
                              </td>
                              <td className="max-w-[200px] truncate px-4 py-3.5 font-medium text-ink">
                                {registration.groupName ?? (
                                  <span className="font-normal text-muted">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-ink">
                                {participants.length}
                                {participants.length !==
                                  registration.participantCount && (
                                  <span className="text-muted">
                                    {" "}
                                    of {registration.participantCount}
                                  </span>
                                )}
                              </td>
                              <td
                                className={cn(
                                  "max-w-[220px] truncate px-4 py-3.5 text-muted",
                                  WIDE_ONLY,
                                )}
                              >
                                {registration.registrantEmail}
                              </td>
                              <td className="px-4 py-3.5 text-ink">
                                {typeShort(
                                  registration.registrationType as RegistrationType,
                                )}
                              </td>
                              <td
                                className={cn(
                                  "px-4 py-3.5",
                                  registration.totalAmount === 0
                                    ? "text-muted"
                                    : "font-medium text-ink",
                                )}
                              >
                                {formatPeso(registration.totalAmount)}
                              </td>
                              <td className="px-4 py-3.5">
                                <ReceiptTag registration={registration} />
                              </td>
                              <td className={cn("px-4 py-3.5", WIDE_ONLY)}>
                                <EmailTag registration={registration} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="font-display text-[22px] font-semibold text-ink">
                      {people.length} participant{people.length === 1 ? "" : "s"}
                      {active && (
                        <span className="ml-2 text-[14px] font-normal text-muted">
                          of {allStats.participants}
                        </span>
                      )}
                    </h1>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rows.length === 0}
                      onClick={() =>
                        downloadCsv(
                          "crossgen-2026-participants.csv",
                          buildParticipantCsv(rows),
                        )
                      }
                    >
                      Export CSV
                    </Button>
                  </div>

                  {people.length === 0 ? (
                    <p className="rounded-2xl border border-line bg-white py-16 text-center text-[15px] text-muted">
                      {active
                        ? "Nobody matches those filters."
                        : "No participants yet."}
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                      <table className="w-full min-w-[660px] text-left">
                        <thead>
                          <tr className="border-b border-line text-[11.5px] font-semibold tracking-[0.07em] text-muted uppercase">
                            <th className="px-4 py-3 font-semibold">Name</th>
                            <th className="px-4 py-3 font-semibold">Age</th>
                            <th className="px-4 py-3 font-semibold">Church</th>
                            <th className={`px-4 py-3 font-semibold ${WIDE_ONLY}`}>City</th>
                            <th className="px-4 py-3 font-semibold">Session</th>
                            <th className={`px-4 py-3 font-semibold ${WIDE_ONLY}`}>Contact</th>
                            <th className="px-4 py-3 font-semibold">Group</th>
                          </tr>
                        </thead>
                        <tbody>
                          {people.map(({ participant, registration }) => (
                            <tr
                              key={participant._id}
                              onClick={() => setOpen(registration._id)}
                              className="cursor-pointer border-b border-line-soft text-[14px] last:border-0 hover:bg-surface"
                            >
                              <td className="px-4 py-3.5 font-medium text-ink">
                                {participant.fullName}
                                <div className="text-[12.5px] font-normal text-muted">
                                  {participant.gender} · {participant.maritalStatus}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-muted">
                                {participant.age}
                              </td>
                              <td className="max-w-[190px] truncate px-4 py-3.5 text-muted">
                                {participant.churchOrganization}
                                <div className="text-[12.5px]">
                                  {participant.ministryInvolvement}
                                </div>
                                <div className="text-[12.5px] xl:hidden">
                                  {participant.cityMunicipality}
                                </div>
                              </td>
                              <td className={cn("px-4 py-3.5 text-muted", WIDE_ONLY)}>
                                {participant.cityMunicipality}
                              </td>
                              <td className="max-w-[220px] px-4 py-3.5 text-muted">
                                {breakoutTitle(participant.breakoutSession)}
                              </td>
                              <td
                                className={cn(
                                  "max-w-[200px] truncate px-4 py-3.5 text-muted",
                                  WIDE_ONLY,
                                )}
                              >
                                {participant.mobileNumber}
                                <div className="text-[12.5px]">{participant.email}</div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="font-semibold text-cg-purple">
                                  {registration.registrationNumber}
                                </span>
                                <div className="text-[12.5px] text-muted">
                                  {registration.groupName ?? "Individual"}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        )}
      </Authenticated>

      <BottomBar />
    </div>
  );
}

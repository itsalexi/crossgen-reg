"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { Button, Eyebrow, Spinner, cn } from "@/components/ui";
import { buildParticipantCsv, downloadCsv } from "@/lib/csv";
import {
  buildRows,
  computeStats,
  EMPTY_FILTERS,
  filterRows,
  amountFor,
  filtersActive,
  paymentIndex,
  registeredAt,
  uniqueValues,
  type Filters,
} from "@/lib/organizer";
import { expectedRates } from "@/lib/groups";
import { AddRegistration } from "./AddRegistration";
import { AdminsSection } from "./AdminsSection";
import { GroupsSection } from "./GroupsSection";
import { SponsorsSection } from "./SponsorsSection";
import { PaymentsSection } from "./PaymentsSection";
import { RegistrationDetail } from "./RegistrationDetail";
import {
  BarList,
  EmailTag,
  Panel,
  ReceiptTag,
  shortDate,
  SourceTag,
  StatTile,
} from "./parts";

type Section =
  | "overview"
  | "registrations"
  | "people"
  | "groups"
  | "payments"
  | "sponsors"
  | "admins";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "registrations", label: "Registrations" },
  { key: "people", label: "Participants" },
  { key: "groups", label: "Groups" },
  { key: "payments", label: "Payments" },
  { key: "sponsors", label: "Sponsors" },
  { key: "admins", label: "Organizers" },
];

const CONTROL =
  "h-10 w-full min-w-0 rounded-[10px] border border-line bg-white px-3 text-[14px] text-ink";

// Between the rail and the table there is only ~820px at 1180px wide, which is
// less than these tables want. Rather than an inner scrollbar, the columns that
// are recoverable from the detail view drop out until there is room.
const WIDE_ONLY = "hidden xl:table-cell";


/**
 * The whole view lives in the query string: which section, which registration
 * is open, and every filter. Back goes back, reload lands where you were, and
 * a link pasted to another organizer opens on what you were looking at.
 */
const FILTER_PARAM: Record<keyof Filters, string> = {
  search: "q",
  type: "type",
  session: "session",
  payment: "payment",
  email: "email",
  church: "church",
  city: "city",
  dateFrom: "from",
  dateTo: "to",
};

function readFilters(params: URLSearchParams): Filters {
  const value = (key: keyof Filters) => params.get(FILTER_PARAM[key]) ?? "";
  const session = value("session");
  return {
    search: value("search"),
    type: value("type") as Filters["type"],
    session: session.length > 0 ? Number(session) : "",
    payment: value("payment") as Filters["payment"],
    email: value("email") as Filters["email"],
    church: value("church"),
    city: value("city"),
    dateFrom: value("dateFrom"),
    dateTo: value("dateTo"),
  };
}

function buildQuery(
  section: Section,
  open: Id<"registrations"> | null,
  filters: Filters,
): string {
  const params = new URLSearchParams();
  // Overview is the default, so it stays out of the URL.
  if (section !== "overview") params.set("tab", section);
  if (open !== null) params.set("reg", open);
  for (const key of Object.keys(FILTER_PARAM) as (keyof Filters)[]) {
    const value = String(filters[key]);
    if (value.length > 0) params.set(FILTER_PARAM[key], value);
  }
  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

export function OrganizerDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const sectionParam = params.get("tab") as Section | null;
  const section: Section =
    sectionParam !== null && SECTIONS.some((s) => s.key === sectionParam)
      ? sectionParam
      : "overview";
  const open = params.get("reg") as Id<"registrations"> | null;
  const filters = useMemo(
    () => readFilters(new URLSearchParams(params.toString())),
    [params],
  );

  const go = (
    next: {
      section?: Section;
      open?: Id<"registrations"> | null;
      filters?: Filters;
    },
    // Moving between sections and registrations is navigation and belongs in
    // history. Typing in a filter box is not — it would bury the back button
    // under one entry per keystroke.
    mode: "push" | "replace" = "push",
  ) => {
    const url =
      pathname +
      buildQuery(
        next.section ?? section,
        next.open !== undefined ? next.open : open,
        next.filters ?? filters,
      );
    if (mode === "push") router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };

  const setSection = (key: Section) => go({ section: key, open: null });
  const setOpen = (registrationId: Id<"registrations"> | null) =>
    go({ open: registrationId });
  const setFilters = (next: Filters) => go({ filters: next }, "replace");

  const [resending, setResending] = useState(false);

  const isOrganizer = useQuery(api.organizer.amIOrganizer);
  const data = useQuery(
    api.organizer.snapshot,
    isOrganizer === true ? {} : "skip",
  );
  const resendAllFailed = useMutation(api.organizer.resendAllFailed);

  const allRows = useMemo(
    () => (data ? buildRows(data.registrations, data.participants) : []),
    [data],
  );
  const rows = useMemo(() => filterRows(allRows, filters), [allRows, filters]);
  const people = useMemo(
    () =>
      rows.flatMap((row) =>
        row.participants.map((participant) => ({
          participant,
          registration: row.registration,
        })),
      ),
    [rows],
  );
  const payments = useMemo(() => data?.payments ?? [], [data]);
  const stats = useMemo(() => computeStats(rows, payments), [rows, payments]);
  const allStats = useMemo(
    () => computeStats(allRows, payments),
    [allRows, payments],
  );
  const paidIndex = useMemo(
    () => paymentIndex(allRows, payments),
    [allRows, payments],
  );
  // Priced off the group someone came with, so the imported rows that carry no
  // amount of their own are counted rather than quietly skipped.
  const expected = useMemo(
    () => expectedRates(allRows).totalFor(rows),
    [allRows, rows],
  );
  const churches = useMemo(
    () => uniqueValues(allRows, (p) => p.churchOrganization ?? ""),
    [allRows],
  );
  const cities = useMemo(
    () => uniqueValues(allRows, (p) => p.cityMunicipality ?? ""),
    [allRows],
  );

  const active = filtersActive(filters);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar href="/organizer" right={<AccountBar />} />

      <AuthLoading>
        <div className="flex flex-1 items-center justify-center py-24">
          <Spinner className="size-6 text-cg-purple" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start gap-5 px-5 py-20">
          <h1 className="font-display text-[26px] font-semibold text-ink">
            Organizers only
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Sign in with the Google account that was added to the organizer
            list, and the registrations open up.
          </p>
          <GoogleSignIn redirectTo="/organizer" />
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
            {/* Volunteers land here by accident: their account works, just not
                for this page. Send them where it does. */}
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Working the door?{" "}
              <a
                href="/organizer/checkin"
                className="font-semibold text-cg-purple underline"
              >
                Open the check-in screen
              </a>
              .
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
                    onClick={() => setSection(entry.key)}
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

              <a
                href="/organizer/checkin"
                className="rounded-xl border border-line bg-white px-4 py-3 text-center text-[14px] font-semibold text-cg-purple hover:border-cg-purple-soft"
              >
                Open the check-in door
              </a>

              {section !== "admins" && (
                <>
                  <div className="flex flex-col gap-1 rounded-xl border border-line bg-white px-4 py-3.5">
                    <Eyebrow>
                      {active ? "Matching now" : "All registrations"}
                    </Eyebrow>
                    <p className="font-display text-[22px] leading-tight font-bold text-ink">
                      {stats.participants}
                      <span className="ml-1.5 text-[13px] font-medium text-muted">
                        people
                      </span>
                    </p>
                    <p className="text-[13px] text-muted">
                      {stats.registrations} registration
                      {stats.registrations === 1 ? "" : "s"} ·{" "}
                      {formatPeso(expected)} expected
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
                      onChange={(e) =>
                        set({ type: e.target.value as Filters["type"] })
                      }
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
                          session:
                            e.target.value === "" ? "" : Number(e.target.value),
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
                          // One call, not two: each go() builds the whole URL
                          // from this render's state, so a second would drop
                          // what the first just set.
                          onClick={() =>
                            go({
                              section: "registrations",
                              open: null,
                              filters: {
                                ...filters,
                                payment: "receipt-missing",
                              },
                            })
                          }
                          className="text-left text-[14px] font-medium text-cg-gold-ink hover:underline"
                        >
                          {allStats.receiptsMissing} without a receipt
                        </button>
                      )}
                      {allStats.emailsFailed > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            go({
                              section: "registrations",
                              open: null,
                              filters: { ...filters, email: "failed" },
                            })
                          }
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
                <RegistrationDetail
                  registrationId={open}
                  onBack={() => setOpen(null)}
                />
              ) : section === "admins" ? (
                <AdminsSection />
              ) : section === "sponsors" ? (
                <SponsorsSection />
              ) : section === "groups" ? (
                <GroupsSection
                  rows={rows}
                  allRows={allRows}
                  payments={data.payments}
                  decisions={data.groupDecisions}
                  onOpen={setOpen}
                />
              ) : section === "payments" ? (
                <PaymentsSection
                  rows={rows}
                  allRows={allRows}
                  payments={data.payments}
                  onOpen={setOpen}
                />
              ) : section === "overview" ? (
                <div className="flex flex-col gap-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatTile
                      label="Participants"
                      value={String(stats.participants)}
                      note={`across ${stats.registrations} registration${stats.registrations === 1 ? "" : "s"}`}
                    />
                    <StatTile
                      label="Confirmed received"
                      value={formatPeso(stats.received)}
                      note={`${stats.referencesChecked} of ${stats.referencesTotal} payment references checked`}
                    />
                    <StatTile
                      label="Expected in total"
                      value={formatPeso(expected)}
                      note="₱350 each in a group of five or more, ₱450 on your own"
                    />
                    <StatTile
                      label="Not paying"
                      value={String(stats.exemptParticipants)}
                      note="speakers, volunteers, sponsors"
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
                          <dd className="font-semibold text-ink">
                            {stats.minors}
                          </dd>
                        </div>
                      </dl>
                    </Panel>
                    <Panel title="Churches">
                      <BarList
                        items={stats.byChurch}
                        total={stats.participants}
                      />
                    </Panel>
                    <Panel title="Cities">
                      <BarList
                        items={stats.byCity}
                        total={stats.participants}
                      />
                    </Panel>
                    <Panel title="Where they heard about it">
                      <BarList
                        items={stats.byHeardFrom}
                        total={stats.registrations}
                        empty="Nobody has answered yet."
                      />
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
                            void resendAllFailed().finally(() =>
                              setResending(false),
                            );
                          }}
                        >
                          Retry all
                        </Button>
                      }
                    >
                      <ul className="flex flex-col">
                        {rows
                          .filter(
                            (r) =>
                              r.registration.confirmationEmailStatus ===
                              "failed",
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
                      {stats.imported > 0 && (
                        <span className="ml-2 text-[14px] font-normal text-muted">
                          · {stats.imported} from the Google Form
                        </span>
                      )}
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
                          buildParticipantCsv(rows, payments),
                        )
                      }
                    >
                      Export CSV
                    </Button>
                  </div>

                  <AddRegistration onAdded={() => {}} />

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
                            <th
                              className={`px-4 py-3 font-semibold ${WIDE_ONLY}`}
                            >
                              Registered by
                            </th>
                            <th className="px-4 py-3 font-semibold">Type</th>
                            <th className="px-4 py-3 font-semibold">Amount</th>
                            <th className="px-4 py-3 font-semibold">Receipt</th>
                            <th
                              className={`px-4 py-3 font-semibold ${WIDE_ONLY}`}
                            >
                              Email
                            </th>
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
                                  {shortDate(registeredAt(registration))}
                                </div>
                              </td>
                              <td className="max-w-[220px] px-4 py-3.5 font-medium text-ink">
                                <div className="truncate">
                                  {registration.groupName ?? (
                                    <span className="font-normal text-muted">
                                      —
                                    </span>
                                  )}
                                </div>
                                <SourceTag registration={registration} />
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
                                  registration.totalAmount === 0 ||
                                    registration.amountUnknown === true
                                    ? "text-muted"
                                    : "font-medium text-ink",
                                )}
                              >
                                {(() => {
                                  const { value, approximate } = amountFor(
                                    registration,
                                    paidIndex,
                                  );
                                  if (value === null) return "—";
                                  return (
                                    <span
                                      title={
                                        approximate
                                          ? "This person's share of a deposit that covered several people"
                                          : undefined
                                      }
                                    >
                                      {approximate ? "≈" : ""}
                                      {formatPeso(value)}
                                    </span>
                                  );
                                })()}
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
                      {people.length} participant
                      {people.length === 1 ? "" : "s"}
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
                          buildParticipantCsv(rows, payments),
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
                            <th
                              className={`px-4 py-3 font-semibold ${WIDE_ONLY}`}
                            >
                              City
                            </th>
                            <th className="px-4 py-3 font-semibold">Session</th>
                            <th
                              className={`px-4 py-3 font-semibold ${WIDE_ONLY}`}
                            >
                              Contact
                            </th>
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
                                  {participant.gender} ·{" "}
                                  {participant.maritalStatus}
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
                              <td
                                className={cn(
                                  "px-4 py-3.5 text-muted",
                                  WIDE_ONLY,
                                )}
                              >
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
                                <div className="text-[12.5px]">
                                  {participant.email}
                                </div>
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

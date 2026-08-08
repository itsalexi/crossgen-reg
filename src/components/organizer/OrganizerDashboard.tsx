"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import {
  BREAKOUT_SESSIONS,
  breakoutTitle,
  formatPeso,
  REGISTRATION_TYPES,
} from "@convex/shared";
import { buildParticipantCsv, downloadCsv } from "@/lib/csv";
import {
  Badge,
  Button,
  Card,
  SectionLabel,
  SelectInput,
  Spinner,
  TextInput,
  cn,
} from "@/components/ui";

type Row = {
  registration: Doc<"registrations">;
  participants: Doc<"participants">[];
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toStartOfDay(value: string): number | undefined {
  if (value.length === 0) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function toEndOfDay(value: string): number | undefined {
  if (value.length === 0) return undefined;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function EmailStatus({ registration }: { registration: Doc<"registrations"> }) {
  if (registration.confirmationEmailStatus === "sent") {
    return <Badge tone="neutral">Email sent</Badge>;
  }
  if (registration.confirmationEmailStatus === "pending") {
    return <Badge tone="blue">Email sending</Badge>;
  }
  return <Badge tone="orange">Email failed</Badge>;
}

function RegistrationDetail({ registrationId }: { registrationId: Id<"registrations"> }) {
  const detail = useQuery(api.organizer.get, { registrationId });
  const resend = useMutation(api.organizer.resendConfirmation);
  const [resending, setResending] = useState(false);

  if (detail === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="size-5 text-cg-purple" />
      </div>
    );
  }
  if (detail === null) return null;

  const { registration, participants, paymentProofUrl } = detail;

  return (
    <div className="border-t border-line bg-surface p-5">
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>
          <SectionLabel>Participants</SectionLabel>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead>
                <tr className="text-[11.5px] tracking-wide text-muted uppercase">
                  <th className="pb-2 font-semibold">Name</th>
                  <th className="pb-2 font-semibold">Age</th>
                  <th className="pb-2 font-semibold">Contact</th>
                  <th className="pb-2 font-semibold">Church</th>
                  <th className="pb-2 font-semibold">Breakout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {participants.map((participant) => (
                  <tr key={participant._id} className="align-top">
                    <td className="py-2.5 pr-4">
                      <span className="font-semibold text-ink">
                        {participant.fullName}
                      </span>
                      {participant.preferredName && (
                        <span className="ml-1 text-muted">
                          ({participant.preferredName})
                        </span>
                      )}
                      <div className="text-[12.5px] text-muted">
                        {participant.gender} · {participant.maritalStatus} ·{" "}
                        {participant.occupation}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-ink">{participant.age}</td>
                    <td className="py-2.5 pr-4 text-muted">
                      {participant.email}
                      <div>{participant.mobileNumber}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted">
                      {participant.churchOrganization}
                      <div className="text-[12.5px]">
                        {participant.ministryInvolvement}
                      </div>
                      <div className="text-[12.5px]">
                        {participant.cityMunicipality}
                      </div>
                    </td>
                    <td className="py-2.5 text-cg-purple">
                      {participant.breakoutSession}.{" "}
                      {breakoutTitle(participant.breakoutSession)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <SectionLabel>Payment</SectionLabel>
            {registration.paymentType === "exempt" ? (
              <p className="mt-2 text-[13.5px] text-muted">
                Exempt — {registration.exemptionReason}. No payment collected.
              </p>
            ) : (
              <div className="mt-2 text-[13.5px] text-ink">
                <p>
                  Reference:{" "}
                  <span className="font-semibold">
                    {registration.paymentReference}
                  </span>
                </p>
                <p className="text-muted">Paid {registration.datePaid}</p>
                {paymentProofUrl !== null ? (
                  <a
                    href={paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 font-semibold text-cg-purple hover:underline"
                  >
                    Open proof of payment
                    {registration.paymentProofFileName && (
                      <span className="font-normal text-muted">
                        ({registration.paymentProofFileName})
                      </span>
                    )}
                  </a>
                ) : (
                  <p className="mt-2 text-muted">No file attached.</p>
                )}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Confirmation email</SectionLabel>
            <div className="mt-2 flex flex-col items-start gap-2">
              <EmailStatus registration={registration} />
              {registration.confirmationEmailError && (
                <p className="text-[12.5px] leading-relaxed text-red-600">
                  {registration.confirmationEmailError}
                </p>
              )}
              <Button
                size="sm"
                variant="secondary"
                loading={resending}
                onClick={() => {
                  setResending(true);
                  void resend({ registrationId }).finally(() =>
                    setResending(false),
                  );
                }}
              >
                Resend email
              </Button>
            </div>
          </div>

          <div>
            <SectionLabel>Registrant</SectionLabel>
            <p className="mt-2 text-[13.5px] text-ink">
              {registration.registrantName}
            </p>
            <p className="text-[13px] text-muted">
              {registration.registrantEmail}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegistrationRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const { registration, participants } = row;
  const typeLabel =
    REGISTRATION_TYPES.find((t) => t.value === registration.registrationType)
      ?.label ?? registration.registrationType;

  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-surface"
      >
        <svg
          viewBox="0 0 16 16"
          className={cn(
            "size-4 shrink-0 text-muted transition-transform",
            open && "rotate-90",
          )}
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m6 4 4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[15px] font-bold text-cg-purple">
              {registration.registrationNumber}
            </span>
            {registration.groupName && (
              <span className="truncate font-semibold text-ink">
                {registration.groupName}
              </span>
            )}
            <Badge
              tone={registration.paymentType === "exempt" ? "teal" : "purple"}
            >
              {typeLabel}
            </Badge>
          </div>
          <p className="mt-1 truncate text-[13px] text-muted">
            {participants.length}{" "}
            {participants.length === 1 ? "participant" : "participants"} ·{" "}
            {formatDate(registration._creationTime)} ·{" "}
            {registration.registrantEmail}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-display font-bold text-ink">
            {formatPeso(registration.totalAmount)}
          </p>
          <p className="text-[12.5px] text-muted">
            {registration.paymentReference ?? "—"}
          </p>
        </div>
      </button>

      {open && <RegistrationDetail registrationId={registration._id} />}
    </li>
  );
}

export function OrganizerDashboard() {
  const [search, setSearch] = useState("");
  const [registrationType, setRegistrationType] = useState("");
  const [breakoutSession, setBreakoutSession] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isOrganizer = useQuery(api.organizer.amIOrganizer);

  const data = useQuery(
    api.organizer.list,
    isOrganizer === true
      ? {
          search: search.trim().length > 0 ? search.trim() : undefined,
          registrationType:
            registrationType.length > 0
              ? (registrationType as "regular" | "speaker" | "volunteer" | "sponsor")
              : undefined,
          breakoutSession:
            breakoutSession.length > 0
              ? (Number(breakoutSession) as 1 | 2 | 3 | 4 | 5)
              : undefined,
          paymentType:
            paymentType.length > 0 ? (paymentType as "paid" | "exempt") : undefined,
          dateFrom: toStartOfDay(dateFrom),
          dateTo: toEndOfDay(dateTo),
        }
      : "skip",
  );

  const filtersActive =
    search.length > 0 ||
    registrationType.length > 0 ||
    breakoutSession.length > 0 ||
    paymentType.length > 0 ||
    dateFrom.length > 0 ||
    dateTo.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      <AuthLoading>
        <div className="flex justify-center py-20">
          <Spinner className="size-6 text-cg-purple" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold text-ink">
            Organizer sign-in required
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            Sign in with an authorized organizer account to view registrations.
          </p>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {isOrganizer === undefined ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-6 text-cg-purple" />
          </div>
        ) : isOrganizer === false ? (
          <Card className="text-center">
            <h1 className="font-display text-xl font-bold text-ink">
              Not an authorized organizer
            </h1>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted">
              This account is not on the organizer list. Ask the CrossGen team to
              add your email address, then reload this page.
            </p>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-ink">
                  Registrations
                </h1>
                <p className="mt-1.5 text-[15px] text-muted">
                  {data === undefined
                    ? "Loading…"
                    : `${data.totals.registrations} registration${
                        data.totals.registrations === 1 ? "" : "s"
                      } · ${data.totals.participants} participant${
                        data.totals.participants === 1 ? "" : "s"
                      } · ${formatPeso(data.totals.amount)} total`}
                  {data !== undefined &&
                    filtersActive &&
                    ` (filtered from ${data.totals.allRegistrations})`}
                </p>
              </div>

              <Button
                variant="secondary"
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

            <div className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
              <TextInput
                label="Search"
                placeholder="Registration #, name, group, reference"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <SelectInput
                label="Registration type"
                placeholder="All types"
                options={REGISTRATION_TYPES.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
                value={registrationType}
                onChange={(e) => setRegistrationType(e.target.value)}
              />
              <SelectInput
                label="Breakout session"
                placeholder="All sessions"
                options={BREAKOUT_SESSIONS.map((s) => ({
                  value: s.value,
                  label: `${s.value}. ${s.title}`,
                }))}
                value={breakoutSession}
                onChange={(e) => setBreakoutSession(e.target.value)}
              />
              <SelectInput
                label="Payment type"
                placeholder="All payment types"
                options={[
                  { value: "paid", label: "Paid" },
                  { value: "exempt", label: "Exempt" },
                ]}
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
              />
              <TextInput
                label="Registered from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <TextInput
                label="Registered to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {data === undefined ? (
              <div className="flex justify-center py-20">
                <Spinner className="size-6 text-cg-purple" />
              </div>
            ) : data.rows.length === 0 ? (
              <Card className="mt-6 text-center">
                <p className="text-[15px] text-muted">
                  {filtersActive
                    ? "No registrations match these filters."
                    : "No registrations yet."}
                </p>
              </Card>
            ) : (
              <ul className="mt-6 flex flex-col gap-3">
                {data.rows.map((row) => (
                  <RegistrationRow key={row.registration._id} row={row} />
                ))}
              </ul>
            )}
          </>
        )}
      </Authenticated>
    </div>
  );
}

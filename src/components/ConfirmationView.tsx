"use client";

import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  breakoutTitle,
  EVENT,
  formatPeso,
  isExempt,
  REGISTRATION_TYPES,
  type RegistrationType,
} from "@convex/shared";
import { Badge, Card, SectionLabel, Spinner } from "@/components/ui";

function CheckSeal() {
  return (
    <span className="flex size-14 items-center justify-center rounded-full bg-cg-gold">
      <svg viewBox="0 0 24 24" className="size-7 text-ink" fill="none" aria-hidden="true">
        <path
          d="m6 12.5 4 4 8-9"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function ConfirmationView({ registrationId }: { registrationId: string }) {
  const data = useQuery(api.registrations.getMine, {
    registrationId: registrationId as Id<"registrations">,
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12">
      <AuthLoading>
        <div className="flex justify-center py-20">
          <Spinner className="size-6 text-cg-purple" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold text-ink">
            Sign in to view this registration
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            Registrations are only visible to the account that submitted them.
          </p>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {data === undefined ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-6 text-cg-purple" />
          </div>
        ) : data === null ? (
          <Card className="text-center">
            <h1 className="font-display text-xl font-bold text-ink">
              Registration not found
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              This registration does not exist, or it belongs to a different
              account.
            </p>
            <Link
              href="/register"
              className="mt-5 inline-block text-[15px] font-semibold text-cg-purple hover:underline"
            >
              Start a new registration
            </Link>
          </Card>
        ) : (
          (() => {
            const { registration, participants } = data;
            const type = registration.registrationType as RegistrationType;
            const exempt = isExempt(type);
            const typeLabel =
              REGISTRATION_TYPES.find((t) => t.value === type)?.label ?? type;

            return (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-start gap-5 rounded-2xl border border-line bg-white p-7">
                  <CheckSeal />
                  <div>
                    <h1 className="font-display text-2xl font-bold text-ink">
                      Registration received
                    </h1>
                    <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">
                      Thank you for registering for the {EVENT.name}.{" "}
                      {exempt
                        ? "No payment is required for this registration."
                        : "We have received your registration and your proof of payment."}
                    </p>
                  </div>

                  <div className="w-full rounded-xl bg-cg-purple-tint p-5">
                    <SectionLabel>Registration number</SectionLabel>
                    <p className="mt-1 font-display text-3xl font-bold tracking-tight text-cg-purple">
                      {registration.registrationNumber}
                    </p>
                    <p className="mt-2 text-[13px] text-muted">
                      Keep this for your records. We have emailed a copy to{" "}
                      <span className="font-medium text-ink">
                        {registration.registrantEmail}
                      </span>
                      .
                    </p>
                  </div>
                </div>

                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    {registration.groupName && (
                      <span className="font-display text-lg font-bold text-ink">
                        {registration.groupName}
                      </span>
                    )}
                    <Badge tone={exempt ? "teal" : "purple"}>{typeLabel}</Badge>
                    <span className="text-sm text-muted">
                      {registration.participantCount}{" "}
                      {registration.participantCount === 1
                        ? "participant"
                        : "participants"}
                    </span>
                  </div>

                  <dl className="mt-5 divide-y divide-line border-y border-line">
                    <div className="flex items-center justify-between gap-4 py-3">
                      <dt className="text-sm text-muted">Amount</dt>
                      <dd className="font-display text-lg font-bold text-ink">
                        {formatPeso(registration.totalAmount)}
                      </dd>
                    </div>
                    {registration.paymentReference && (
                      <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-sm text-muted">Payment reference</dt>
                        <dd className="text-sm font-semibold text-ink">
                          {registration.paymentReference}
                        </dd>
                      </div>
                    )}
                    {registration.datePaid && (
                      <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-sm text-muted">Date paid</dt>
                        <dd className="text-sm font-semibold text-ink">
                          {registration.datePaid}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-5">
                    <SectionLabel>Participants</SectionLabel>
                    <ul className="mt-3 flex flex-col gap-3">
                      {participants.map((participant) => (
                        <li key={participant._id}>
                          <p className="font-semibold text-ink">
                            {participant.fullName}
                          </p>
                          <p className="text-[13.5px] text-muted">
                            {breakoutTitle(participant.breakoutSession)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>

                <div className="rounded-2xl border border-line bg-white p-6">
                  <SectionLabel>Event details</SectionLabel>
                  <p className="mt-2 font-display font-bold text-ink">
                    {EVENT.name}
                  </p>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-muted">
                    {EVENT.date} ({EVENT.dayOfWeek})
                    <br />
                    {EVENT.venue}
                    <br />
                    {EVENT.address}
                  </p>
                </div>

                {!exempt && (
                  <p className="text-[13px] leading-relaxed text-muted">
                    This confirms that we received your proof of payment. It is not
                    a confirmation that the payment has been verified — the
                    CrossGen team reviews payments separately.
                  </p>
                )}

                <Link
                  href="/register"
                  className="text-center text-[15px] font-semibold text-cg-purple hover:underline"
                >
                  Register another group
                </Link>
              </div>
            );
          })()
        )}
      </Authenticated>
    </div>
  );
}

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
  spellCount,
  titleCaseCount,
  typeShort,
  type RegistrationType,
} from "@convex/shared";
import { AccountBar, BottomBar, TopBar } from "./brand";
import { Eyebrow, Spinner } from "./ui";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar right={<AccountBar />} />
      <main className="flex-1">{children}</main>
      <BottomBar />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-start gap-4 px-5 py-16 sm:py-24">
      {children}
    </div>
  );
}

export function ConfirmationView({ registrationId }: { registrationId: string }) {
  const data = useQuery(api.registrations.getMine, {
    registrationId: registrationId as Id<"registrations">,
  });

  return (
    <Shell>
      <AuthLoading>
        <div className="flex justify-center py-24">
          <Spinner className="size-6 text-cg-purple" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <Centered>
          <h1 className="font-display text-[26px] leading-tight font-semibold text-ink">
            Sign in to see this
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            A registration is only visible to the account that sent it in.
          </p>
        </Centered>
      </Unauthenticated>

      <Authenticated>
        {data === undefined ? (
          <div className="flex justify-center py-24">
            <Spinner className="size-6 text-cg-purple" />
          </div>
        ) : data === null ? (
          <Centered>
            <h1 className="font-display text-[26px] leading-tight font-semibold text-ink">
              We can&rsquo;t find that one
            </h1>
            <p className="text-[15px] leading-relaxed text-muted">
              This registration doesn&rsquo;t exist, or it belongs to a different
              account.
            </p>
            <Link
              href="/register"
              className="text-[15px] font-semibold text-cg-purple hover:underline"
            >
              Start a new registration
            </Link>
          </Centered>
        ) : (
          (() => {
            const { registration, participants } = data;
            const type = registration.registrationType as RegistrationType;
            const exempt = isExempt(type);
            const greeting =
              registration.registrantName.trim().split(/\s+/)[0] || "there";
            const groupLabel = registration.groupName
              ? `${registration.groupName}, ${registration.participantCount}`
              : titleCaseCount(registration.participantCount) +
                (registration.participantCount === 1 ? " person" : " people");

            return (
              <div className="mx-auto w-full max-w-[820px]">
                <div className="flex flex-col gap-5 bg-cg-purple px-6 py-10 sm:gap-5.5 sm:px-9 sm:py-12">
                  <Eyebrow className="text-cg-gold">See you in September</Eyebrow>
                  <h1 className="font-display text-[30px] leading-[1.1] font-bold tracking-[-0.03em] text-white sm:text-[38px]">
                    You&rsquo;re all set, {greeting}.
                  </h1>
                  <div className="flex w-fit flex-col gap-1 rounded-2xl bg-white/10 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                    <Eyebrow className="text-white/65">Your number</Eyebrow>
                    <span className="font-display text-[26px] leading-none font-bold tracking-[0.01em] text-white">
                      {registration.registrationNumber}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-7 px-6 py-9 sm:px-9">
                  <p className="max-w-[58ch] text-[16px] leading-relaxed text-ink text-pretty">
                    {exempt
                      ? "We've got your registration — nothing to pay for this one."
                      : "We've got your registration and your receipt."}{" "}
                    A copy is on its way to{" "}
                    <span className="font-medium">
                      {registration.registrantEmail}
                    </span>
                    . Bring your number on the day — that&rsquo;s all we need to
                    find you at the door.
                  </p>

                  <dl className="grid gap-5 sm:grid-cols-3 sm:gap-0">
                    <div className="flex flex-col gap-1 sm:pr-6">
                      <Eyebrow>{registration.groupName ? "Your group" : "Registered"}</Eyebrow>
                      <dd className="font-display text-[17px] leading-snug font-semibold text-ink">
                        {groupLabel}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1 sm:border-l sm:border-line sm:px-6">
                      <Eyebrow>{exempt ? "Registration fee" : "Sent"}</Eyebrow>
                      <dd className="font-display text-[17px] leading-snug font-semibold text-ink">
                        {formatPeso(registration.totalAmount)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1 sm:border-l sm:border-line sm:pl-6">
                      <Eyebrow>See you</Eyebrow>
                      <dd className="font-display text-[17px] leading-snug font-semibold text-ink">
                        Sept 26, 2026
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-col">
                    <Eyebrow>
                      {participants.length === 1
                        ? "Your session"
                        : "Everyone and their sessions"}
                    </Eyebrow>
                    <div className="mt-2.5">
                      {participants.map((participant) => (
                        <div
                          key={participant._id}
                          className="flex flex-col gap-0.5 border-t border-line py-3 last:border-b sm:flex-row sm:justify-between sm:gap-5"
                        >
                          <span className="text-[15px] font-medium text-ink">
                            {participant.fullName}
                          </span>
                          <span className="max-w-[46ch] text-[13.5px] leading-snug text-muted sm:text-right sm:text-[14px]">
                            {breakoutTitle(participant.breakoutSession)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 rounded-2xl bg-surface px-5 py-4.5">
                    <Eyebrow>Where to be</Eyebrow>
                    <span className="text-[15.5px] leading-normal font-semibold text-ink">
                      {EVENT.dayOfWeek}, {EVENT.date}
                    </span>
                    <span className="text-[14.5px] leading-normal text-muted">
                      {EVENT.venue}
                      <br />
                      {EVENT.address}
                    </span>
                  </div>

                  {!exempt && (
                    <p className="text-[13px] leading-relaxed text-muted">
                      This says we received your receipt — not that the payment
                      has been checked yet. The team goes through them by hand
                      and will be in touch if anything looks off.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href="/register"
                      className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-white px-6 text-[15px] font-semibold text-cg-purple transition-colors hover:border-cg-purple-soft hover:bg-cg-purple-tint"
                    >
                      Register another group
                    </Link>
                    <span className="text-[13px] text-muted">
                      {spellCount(participants.length)}{" "}
                      {participants.length === 1 ? "person" : "people"} registered
                      as {typeShort(type).toLowerCase()}
                      {participants.length === 1 ? "" : "s"}.
                    </span>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </Authenticated>
    </Shell>
  );
}

"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EVENT,
  formatPeso,
  GROUP_RATE,
  GROUP_THRESHOLD,
  REGULAR_RATE,
} from "@convex/shared";
import { BottomBar, PcecMark, TopBar } from "./brand";
import { Eyebrow, Spinner } from "./ui";

function RegisterButton() {
  const { signIn } = useAuthActions();
  const { isLoading } = useConvexAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const className =
    "inline-flex h-13.5 w-full items-center justify-center rounded-xl bg-cg-gold px-7 text-base font-semibold text-ink transition-colors hover:bg-cg-gold-soft disabled:opacity-70 sm:w-fit";

  if (isLoading) {
    return (
      <span className={className}>
        <Spinner />
      </span>
    );
  }

  return (
    <>
      <Unauthenticated>
        <button
          type="button"
          className={className}
          disabled={pending}
          onClick={() => {
            setPending(true);
            void signIn("google", { redirectTo: "/register" }).catch(() =>
              setPending(false),
            );
          }}
        >
          {pending ? <Spinner /> : "Register with Google"}
        </button>
      </Unauthenticated>
      <Authenticated>
        <button
          type="button"
          className={className}
          onClick={() => router.push("/register")}
        >
          Continue your registration
        </button>
      </Authenticated>
    </>
  );
}

export function LandingScreen() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        right={
          <div className="flex items-center gap-3">
            <PcecMark />
            <span className="hidden text-[12.5px] leading-tight font-medium text-muted sm:block">
              PCEC Family Commission
            </span>
          </div>
        }
      />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[880px]">
          {/* Shown whole, at its own proportions — the way a Google Form
              header behaves. No crop, so nothing of the lockup is lost. */}
          <Image
            src="/brand/header.png"
            alt="CrossGen Family Summit 2026 — Pamilyang Sama-Sama, Henerasyong Nagkaka-isa"
            width={2000}
            height={420}
            priority
            sizes="(min-width: 880px) 880px, 100vw"
            className="h-auto w-full sm:rounded-b-2xl"
          />

          <div className="flex flex-col gap-7 px-6 py-10 sm:px-10 sm:py-12">
            <div className="flex flex-col gap-3">
              <Eyebrow>
                {EVENT.dayOfWeek}, {EVENT.date}
              </Eyebrow>
              <h1 className="font-display text-[2rem] leading-[1.1] font-bold tracking-[-0.03em] text-ink sm:text-[2.5rem]">
                {EVENT.tagline}
              </h1>
              <p className="text-[16.5px] leading-relaxed text-muted">
                {EVENT.venue}, Las Piñas · {EVENT.minAge} pataas
              </p>
            </div>

            <dl className="flex gap-8 border-y border-line py-5">
              <div className="flex flex-col gap-1">
                <Eyebrow>Solo or family</Eyebrow>
                <dd className="text-[15px] font-medium text-ink">
                  {formatPeso(REGULAR_RATE)} each
                </dd>
              </div>
              <div className="flex flex-col gap-1 border-l border-line pl-8">
                <Eyebrow>{GROUP_THRESHOLD} or more</Eyebrow>
                <dd className="text-[15px] font-medium text-ink">
                  {formatPeso(GROUP_RATE)} each
                </dd>
              </div>
            </dl>

            <RegisterButton />
          </div>
        </div>
      </main>

      <BottomBar />
    </div>
  );
}

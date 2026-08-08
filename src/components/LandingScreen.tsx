"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import Image from "next/image";
import Link from "next/link";
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

const FEE_LINE = `${formatPeso(REGULAR_RATE)} each, or ${formatPeso(GROUP_RATE)} when you come as ${GROUP_THRESHOLD} or more.`;

function Copy() {
  return (
    <>
      <Eyebrow className="text-white/60">
        {EVENT.dayOfWeek}, {EVENT.date}
      </Eyebrow>

      <h1 className="max-w-[13ch] font-display text-[2.25rem] leading-[1.06] font-bold tracking-[-0.03em] text-white sm:text-[2.75rem] lg:text-[3.375rem]">
        {EVENT.tagline.split(",")[0]}
      </h1>

      <p className="max-w-[38ch] text-[16px] leading-relaxed text-white/80 sm:text-[17px]">
        A day together at {EVENT.venue}, Las Piñas. Bring your family — everyone{" "}
        {EVENT.minAge} and up is welcome.
      </p>
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

      {/* ------------------------------------------------------------ phone */}
      {/* Banner band, then one purple field with the button pinned to the
          bottom — no footer bar competing for the thumb. */}
      <main className="flex flex-1 flex-col lg:hidden">
        <div className="relative h-40 flex-none overflow-hidden bg-[#3d2b86] sm:h-52">
          <Image
            src="/brand/header.png"
            alt="CrossGen Family Summit 2026"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>

        <div className="flex flex-1 flex-col gap-4.5 bg-cg-purple px-6 py-8 sm:px-10 sm:py-10">
          <Copy />
          <div className="mt-auto flex flex-col gap-3 pt-6">
            <RegisterButton />
            <span className="text-[14px] leading-normal text-white/70">
              {FEE_LINE}
            </span>
            <Link
              href="/privacy"
              className="text-[13px] text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
            >
              What we do with your details
            </Link>
          </div>
        </div>
      </main>

      {/* ---------------------------------------------------------- desktop */}
      {/* The split from the design. The lockup crop is 700×420, so a panel of
          roughly this shape trims almost nothing off it. */}
      <main className="hidden flex-1 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-h-[460px] flex-col justify-center gap-6 bg-cg-purple px-14 py-16">
          <Copy />
          <div className="flex flex-col gap-3.5 pt-2">
            <RegisterButton />
            <span className="text-[14.5px] leading-normal text-white/70">
              {FEE_LINE}
            </span>
          </div>
        </div>

        {/* Contained, not cover: the panel is portrait and the crop is 1.67:1,
            so covering would slice the wordmark. The letterbox is invisible
            because the panel matches the artwork's own purple. */}
        <div className="relative overflow-hidden bg-[#3a2f7d]">
          <Image
            src="/brand/header-lockup.png"
            alt="CrossGen Family Summit 2026"
            fill
            priority
            sizes="48vw"
            className="object-contain object-center"
          />
        </div>
      </main>

      <div className="hidden lg:block">
        <BottomBar />
      </div>
    </div>
  );
}

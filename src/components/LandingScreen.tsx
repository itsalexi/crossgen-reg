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
import { BottomBar, PcecMark, TopBar, Wordmark } from "./brand";
import { Eyebrow, Spinner } from "./ui";

function RegisterButton({ full = false }: { full?: boolean }) {
  const { signIn } = useAuthActions();
  const { isLoading } = useConvexAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const className = `inline-flex h-13.5 items-center justify-center rounded-xl bg-cg-gold px-7 text-base font-semibold text-ink transition-colors hover:bg-cg-gold-soft disabled:opacity-70 ${full ? "w-full" : "w-full sm:w-fit"}`;

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

      <main className="flex flex-1 flex-col">
        {/* The artwork is a 5:1 banner and only survives as a full-width band.
            In a tall side panel a cover-crop slices the lockup in half, and
            contain leaves it stranded in empty purple. */}
        <div className="relative h-36 flex-none overflow-hidden bg-[#3d2b86] sm:h-48 lg:h-56">
          <Image
            src="/brand/header.png"
            alt="CrossGen Family Summit 2026"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>

        <div className="flex flex-1 flex-col justify-center gap-6 bg-cg-purple px-6 py-10 sm:px-14 sm:py-14 lg:gap-6.5">
          <Eyebrow className="text-white/60">
            {EVENT.dayOfWeek}, {EVENT.date}
          </Eyebrow>

          <h1 className="max-w-[13ch] font-display text-[2.25rem] leading-[1.06] font-bold tracking-[-0.03em] text-white sm:text-[3.375rem]">
            {EVENT.tagline.split(",")[0]}
          </h1>

          <p className="max-w-[38ch] text-[17px] leading-relaxed text-white/80">
            A day together at {EVENT.venue}, Las Piñas. Bring your family —
            everyone {EVENT.minAge} and up is welcome.
          </p>

          <div className="flex flex-col gap-3.5 pt-2">
            <RegisterButton />
            <span className="text-[14.5px] leading-normal text-white/70">
              {FEE_LINE}
            </span>
          </div>
        </div>
      </main>

      <BottomBar />
    </div>
  );
}

export { RegisterButton };

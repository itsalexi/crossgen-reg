"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { EVENT } from "@convex/shared";
import { Button, cn } from "./ui";

/**
 * Typeset wordmark rather than the banner PNG, so the app renders correctly
 * before the artwork lands in public/brand/ and stays crisp at any size.
 */
export function CrossGenWordmark({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const cross = tone === "light" ? "text-white" : "text-cg-purple";

  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="font-display text-[1.35em] leading-none font-bold tracking-[-0.045em]">
        <span className={cross}>cross</span>
        <span className="text-cg-gold">gen</span>
      </span>
      <span
        className={cn(
          "text-[0.62em] leading-none font-medium tracking-tight",
          tone === "light" ? "text-white/70" : "text-muted",
        )}
      >
        Family Summit
      </span>
    </span>
  );
}

/** PCEC Family Commission — teal and white. */
export function PcecMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 48 48" className="size-9 shrink-0" aria-hidden="true">
        <circle cx="24" cy="24" r="24" className="fill-pcec-teal" />
        <path
          d="M10 30c4.6 5.2 9.4 7.8 14 7.8S33.4 35.2 38 30"
          className="stroke-white"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="16.5" cy="19" r="3" className="fill-white" />
        <circle cx="24" cy="15.5" r="3.4" className="fill-white" />
        <circle cx="31.5" cy="19" r="3" className="fill-white" />
        <path
          d="M13.6 30.5v-6.2M24 30.8v-8.4M34.4 30.5v-6.2"
          className="stroke-white"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[11px] leading-tight font-semibold tracking-wide text-pcec-teal-deep uppercase">
        PCEC Family
        <br />
        Commission
      </span>
    </span>
  );
}

function AccountButton() {
  const { signIn, signOut } = useAuthActions();
  const user = useQuery(api.users.me);
  const isOrganizer = useQuery(api.organizer.amIOrganizer);

  return (
    <>
      <Unauthenticated>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void signIn("google")}
        >
          Sign in
        </Button>
      </Unauthenticated>
      <Authenticated>
        <div className="flex items-center gap-3">
          {isOrganizer && (
            <Link
              href="/organizer"
              className="hidden text-sm font-medium text-cg-purple hover:underline sm:block"
            >
              Organizer
            </Link>
          )}
          <span className="hidden max-w-[16ch] truncate text-sm text-muted sm:block">
            {user?.email ?? ""}
          </span>
          <Button size="sm" variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Authenticated>
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-center gap-3">
          <CrossGenWordmark tone="dark" className="text-[15px]" />
          <span className="hidden rounded-full bg-cg-purple-tint px-2 py-0.5 text-[11px] font-semibold text-cg-purple sm:inline">
            2026
          </span>
        </Link>
        <AccountButton />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-sm font-semibold text-ink">
            {EVENT.name}
          </p>
          <p className="mt-1 text-sm text-muted">
            {EVENT.date} · {EVENT.venue}, {EVENT.address}
          </p>
          <Link
            href="/privacy"
            className="mt-3 inline-block text-sm font-medium text-cg-purple hover:underline"
          >
            Privacy notice
          </Link>
        </div>
        <PcecMark />
      </div>
    </footer>
  );
}

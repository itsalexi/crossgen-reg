"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { cn } from "./ui";

/** One colour, tight tracking. The artwork carries the two-tone version. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("wordmark", className)}>crossgen</span>;
}

export function PcecMark({
  size = 30,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/pcec-family-commission.jpg"
      alt="PCEC Family Commission"
      width={size}
      height={size}
      // Explicit box: Tailwind's preflight sets `height: auto` on images,
      // which otherwise fights the width/height attributes.
      style={{ width: size, height: size }}
      className={cn("flex-none rounded-full object-cover", className)}
    />
  );
}

/**
 * The thin bar across every screen. `right` lets each page put its own thing
 * there — the account email, a save state, a breadcrumb — the way the design
 * does.
 */
export function TopBar({
  right,
  href = "/",
  className,
}: {
  right?: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-16 flex-none items-center justify-between gap-4 border-b border-line bg-white px-5 sm:px-10",
        className,
      )}
    >
      <Link href={href} className="text-[20px] text-cg-purple">
        <Wordmark />
      </Link>
      {right}
    </header>
  );
}

export function AccountBar() {
  const me = useQuery(api.users.me);
  const isOrganizer = useQuery(api.organizer.amIOrganizer);
  const { signOut } = useAuthActions();
  const pathname = usePathname();

  return (
    <>
      <Unauthenticated>
        <span className="text-sm text-muted">Not signed in</span>
      </Unauthenticated>
      <Authenticated>
        <div className="flex items-center gap-4">
          {isOrganizer && pathname !== "/organizer" && (
            <Link
              href="/organizer"
              className="text-sm font-medium text-cg-purple hover:underline"
            >
              Organizers
            </Link>
          )}
          <span className="hidden max-w-[24ch] truncate text-sm text-muted sm:block">
            {me?.email ?? ""}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </Authenticated>
    </>
  );
}

export function BottomBar() {
  return (
    <footer className="mt-auto flex flex-none flex-col gap-2 border-t border-line bg-white px-5 py-4 sm:h-15 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-10 sm:py-0">
      <span className="text-[13.5px] text-muted">
        Questions? Message the CrossGen team on Facebook.
      </span>
      <Link
        href="/privacy"
        className="text-[13.5px] font-medium text-cg-purple hover:underline"
      >
        Privacy notice
      </Link>
    </footer>
  );
}

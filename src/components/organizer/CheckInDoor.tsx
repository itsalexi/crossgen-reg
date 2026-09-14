"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { api } from "@convex/_generated/api";
import { Spinner } from "@/components/ui";
import { CheckInScreen } from "./CheckInScreen";

/**
 * Auth shell for the door.
 *
 * Deliberately adds no chrome of its own: the check-in screen is full-bleed,
 * carries its own header, and is the only thing on the phone for an hour.
 */
export function CheckInDoor() {
  const allowed = useQuery(api.checkin.amIOnTheDoor);

  return (
    <>
      <AuthLoading>
        <div className="flex min-h-dvh items-center justify-center">
          <Spinner className="size-6 text-cg-purple" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <main className="mx-auto w-full max-w-md px-5 py-20">
          <h1 className="font-display text-[24px] font-semibold text-ink">
            Organizers only
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            Sign in on the organizer page first, then come back here.
          </p>
          <a
            href="/organizer"
            className="mt-5 inline-block text-[15px] font-semibold text-cg-purple underline"
          >
            Go to the organizer page
          </a>
        </main>
      </Unauthenticated>

      <Authenticated>
        {allowed === false ? (
          <main className="mx-auto w-full max-w-md px-5 py-20">
            <p className="text-[15px] text-muted">
              This account is not on the door list. Ask an organizer to add it.
            </p>
          </main>
        ) : (
          <CheckInScreen />
        )}
      </Authenticated>
    </>
  );
}

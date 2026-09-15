"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/_generated/api";
import { GoogleSignIn } from "@/components/GoogleSignIn";
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

      {/* Signing in happens here, not somewhere else. A volunteer opens the
          link they were sent, on a phone, in a queue: sending them to the
          organizer page to sign in and find their way back is three chances to
          lose them, and the organizer page is not theirs to be on. */}
      <Unauthenticated>
        <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pt-16 pb-8">
          <h1 className="font-display text-[32px] leading-[1.15] font-bold tracking-[-0.025em] text-balance text-ink">
            Check-in desk
          </h1>
          <p className="mt-3 text-[19px] leading-relaxed text-pretty text-muted">
            Sign in with the Google account you gave the organizers. That is all
            you need — this screen is the whole job.
          </p>
          <GoogleSignIn
            redirectTo="/organizer/checkin"
            label="Sign in with Google"
            className="mt-7 w-full"
          />
          <p className="mt-5 text-[17px] leading-relaxed text-faint">
            Use the same account each time, so your check-ins are not split
            across two.
          </p>
        </main>
      </Unauthenticated>

      <Authenticated>
        {allowed === undefined ? (
          <div className="flex min-h-dvh items-center justify-center">
            <Spinner className="size-6 text-cg-purple" />
          </div>
        ) : allowed === false ? (
          <main className="mx-auto w-full max-w-[520px] px-5 pt-16 pb-8">
            <h1 className="font-display text-[30px] leading-[1.15] font-bold text-ink">
              This account is not on the list
            </h1>
            <p className="mt-3 text-[19px] leading-relaxed text-muted">
              Show this screen to an organizer. They can add the account in a
              few seconds, then reload this page.
            </p>
            <SignedInAs />
          </main>
        ) : (
          <CheckInScreen />
        )}
      </Authenticated>
    </>
  );
}

/**
 * Which account they are on, and a way off it.
 *
 * The organizer adding them needs the exact address, and the volunteer will
 * not know which of their Google accounts the phone picked. Showing it is the
 * difference between "add me" and a minute of guessing at the door.
 */
function SignedInAs() {
  const me = useQuery(api.users.me);
  const { signOut } = useAuthActions();

  return (
    <div className="mt-8 border-t border-line pt-5">
      <p className="text-[15px] text-faint">Signed in as</p>
      <p className="mt-1 text-[19px] font-semibold break-all text-ink">
        {me?.email ?? "…"}
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-4 text-[17px] font-semibold text-cg-purple underline"
      >
        Use a different account
      </button>
    </div>
  );
}

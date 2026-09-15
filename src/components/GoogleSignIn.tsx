"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Sign in with Google.
 *
 * Shared by the organizer dashboard and the door, because a volunteer who
 * opens the check-in link should be able to sign in where they are standing
 * rather than be sent to another page to do it and find their way back.
 *
 * `redirectTo` is what brings them back: without it Google returns everybody
 * to the front of the site, which for a volunteer is the registration page and
 * a dead end.
 */
export function GoogleSignIn({
  redirectTo,
  label = "Sign in with Google",
  size = "lg",
  className,
}: {
  redirectTo?: string;
  label?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const { signIn } = useAuthActions();
  const [pending, setPending] = useState(false);

  return (
    <Button
      size={size}
      className={className}
      loading={pending}
      onClick={() => {
        setPending(true);
        void signIn(
          "google",
          redirectTo === undefined ? undefined : { redirectTo },
        ).catch(() => setPending(false));
      }}
    >
      {!pending && (
        <svg viewBox="0 0 18 18" className="size-[18px]" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
      )}
      {label}
    </Button>
  );
}

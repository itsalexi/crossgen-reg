import type { Metadata } from "next";
import { RegistrationClosed } from "@/components/RegistrationClosed";
import { RegisterFlow } from "@/components/register/RegisterFlow";
import { EVENT, registrationClosed } from "@convex/shared";

// The deadline has to be read at request time, not baked in at build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: registrationClosed() ? "Registration closed" : "Register",
  description: registrationClosed()
    ? `Registration for the ${EVENT.name} has closed. The summit is ${EVENT.date} at ${EVENT.venue}, Las Piñas.`
    : `Register yourself or your whole family for the ${EVENT.name}, ${EVENT.date} at ${EVENT.venue}, Las Piñas.`,
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  if (registrationClosed()) return <RegistrationClosed />;
  return <RegisterFlow />;
}

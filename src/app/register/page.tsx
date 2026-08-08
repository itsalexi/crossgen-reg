import type { Metadata } from "next";
import { RegisterFlow } from "@/components/register/RegisterFlow";
import { EVENT } from "@convex/shared";

export const metadata: Metadata = {
  title: "Register",
  description: `Register yourself or your whole family for the ${EVENT.name}, ${EVENT.date} at ${EVENT.venue}, Las Piñas.`,
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return <RegisterFlow />;
}

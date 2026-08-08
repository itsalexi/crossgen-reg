import type { Metadata } from "next";
import { RegisterFlow } from "@/components/register/RegisterFlow";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return <RegisterFlow />;
}

import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { RegisterFlow } from "@/components/register/RegisterFlow";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-surface">
        <RegisterFlow />
      </main>
      <SiteFooter />
    </>
  );
}

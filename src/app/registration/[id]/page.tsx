import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { ConfirmationView } from "@/components/ConfirmationView";

export const metadata: Metadata = {
  title: "Registration received",
};

export default async function RegistrationPage({
  params,
}: PageProps<"/registration/[id]">) {
  const { id } = await params;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-surface">
        <ConfirmationView registrationId={id} />
      </main>
      <SiteFooter />
    </>
  );
}

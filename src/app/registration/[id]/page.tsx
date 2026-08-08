import type { Metadata } from "next";
import { ConfirmationView } from "@/components/ConfirmationView";

export const metadata: Metadata = {
  title: "You're registered",
};

export default async function RegistrationPage({
  params,
}: PageProps<"/registration/[id]">) {
  const { id } = await params;
  return <ConfirmationView registrationId={id} />;
}

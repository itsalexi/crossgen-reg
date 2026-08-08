import type { Metadata } from "next";
import { ConfirmationView } from "@/components/ConfirmationView";

// Someone else's registration should never surface in a search result, and a
// link pasted into a chat should not unfurl a family's details either.
export const metadata: Metadata = {
  title: "You're registered",
  robots: { index: false, follow: false },
  openGraph: { images: [] },
};

export default async function RegistrationPage({
  params,
}: PageProps<"/registration/[id]">) {
  const { id } = await params;
  return <ConfirmationView registrationNumber={id} />;
}

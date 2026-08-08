import type { Metadata } from "next";
import { PrivacyScreen } from "@/components/PrivacyScreen";

export const metadata: Metadata = {
  title: "What we do with your details",
  description:
    "What the CrossGen Family Summit collects at registration, what it is used for, and who can see it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <PrivacyScreen />;
}

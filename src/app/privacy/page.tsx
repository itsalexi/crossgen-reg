import type { Metadata } from "next";
import { PrivacyScreen } from "@/components/PrivacyScreen";

export const metadata: Metadata = {
  title: "Privacy notice",
};

export default function PrivacyPage() {
  return <PrivacyScreen />;
}

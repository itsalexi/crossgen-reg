import type { Metadata } from "next";
import { OrganizerDashboard } from "@/components/organizer/OrganizerDashboard";

export const metadata: Metadata = {
  title: "Organizers",
  robots: { index: false, follow: false },
};

export default function OrganizerPage() {
  return <OrganizerDashboard />;
}

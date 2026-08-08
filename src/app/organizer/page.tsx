import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { OrganizerDashboard } from "@/components/organizer/OrganizerDashboard";

export const metadata: Metadata = {
  title: "Organizer",
  robots: { index: false, follow: false },
};

export default function OrganizerPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-surface">
        <OrganizerDashboard />
      </main>
      <SiteFooter />
    </>
  );
}

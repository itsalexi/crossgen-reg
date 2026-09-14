import type { Metadata } from "next";
import { Suspense } from "react";
import { OrganizerDashboard } from "@/components/organizer/OrganizerDashboard";

export const metadata: Metadata = {
  title: "Organizers",
  robots: { index: false, follow: false },
};

export default function OrganizerPage() {
  // The dashboard keeps its whole view in the query string, and reading that
  // during render needs a boundary.
  return (
    <Suspense>
      <OrganizerDashboard />
    </Suspense>
  );
}

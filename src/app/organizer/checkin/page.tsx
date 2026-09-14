import type { Metadata } from "next";
import { CheckInDoor } from "@/components/organizer/CheckInDoor";

export const metadata: Metadata = {
  title: "Check-in",
  robots: { index: false, follow: false },
};

export default function CheckInPage() {
  return <CheckInDoor />;
}

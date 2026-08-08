import type { Metadata } from "next";
import { LandingScreen } from "@/components/LandingScreen";
import { EVENT } from "@convex/shared";

export const metadata: Metadata = {
  title: `${EVENT.name} — Registration`,
  description: `Pamilyang Sama-Sama, Henerasyong Nagkaka-isa. ${EVENT.date} at ${EVENT.venue}, ${EVENT.address}.`,
};

export default function HomePage() {
  return <LandingScreen />;
}

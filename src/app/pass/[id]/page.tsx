import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { EVENT } from "@convex/shared";
import { BottomBar, PcecMark, TopBar } from "@/components/brand";
import { DoorPass } from "@/components/DoorPass";

// A pass is a ticket. It should never be indexed, and a link pasted into a
// group chat should not unfurl somebody's name.
export const metadata: Metadata = {
  title: "Your check-in code",
  robots: { index: false, follow: false },
  openGraph: { images: [] },
};

export default async function PassPage({ params }: PageProps<"/pass/[id]">) {
  const { id } = await params;
  const pass = await fetchQuery(api.checkin.pass, { participantId: id });

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar right={<PcecMark />} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
        {pass === null ? (
          <>
            <h1 className="font-display text-[24px] font-semibold text-ink">
              We can&rsquo;t find that code
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Check the link in your email, or just give your surname at the
              registration table on the day. That always works.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-[26px] leading-tight font-bold text-ink">
              Show this at the door
            </h1>
            <p className="mt-2 mb-6 text-[15px] leading-relaxed text-muted">
              Screenshot it, or open this page again on the day. No internet
              needed if you screenshot it.
            </p>
            <DoorPass
              id={pass.id}
              name={pass.name}
              session={pass.session}
              registrationNumber={pass.registrationNumber}
              group={pass.group}
            />
            <p className="mt-6 text-[14px] leading-relaxed text-muted">
              {EVENT.dayOfWeek}, {EVENT.date}, {EVENT.startTime} at{" "}
              {EVENT.venue}, {EVENT.address}.
            </p>
          </>
        )}
      </main>
      <BottomBar />
    </div>
  );
}

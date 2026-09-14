import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { EVENT } from "@convex/shared";
import { BottomBar, PcecMark, TopBar } from "@/components/brand";
import { DoorPass } from "@/components/DoorPass";

export const metadata: Metadata = {
  title: "Check-in codes",
  robots: { index: false, follow: false },
  openGraph: { images: [] },
};

/**
 * Every code on one registration, for whoever registered the group.
 *
 * A coordinator with twenty people opens this once and scrolls, or prints it
 * and hands the slips out. Printing is why each pass is its own bordered card.
 */
export default async function PassesPage({
  params,
}: PageProps<"/passes/[number]">) {
  const { number } = await params;
  const data = await fetchQuery(api.checkin.passesFor, {
    registrationNumber: decodeURIComponent(number),
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar right={<PcecMark />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        {data === null ? (
          <>
            <h1 className="font-display text-[24px] font-semibold text-ink">
              We can&rsquo;t find that registration
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              Check the number in your confirmation email.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-[26px] leading-tight font-bold text-ink">
              {data.group.length > 0 ? data.group : data.registrationNumber}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {data.people.length}{" "}
              {data.people.length === 1 ? "code" : "codes"} for{" "}
              {data.registrationNumber}. Each person shows their own at the
              door, or you can show them from this page one at a time.
            </p>
            <p className="mt-1 text-[14px] text-muted">
              {EVENT.dayOfWeek}, {EVENT.date}, {EVENT.startTime} at{" "}
              {EVENT.venue}.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {data.people.map((person) => (
                <DoorPass
                  key={person.id}
                  id={person.id}
                  name={person.name}
                  session={person.session}
                  registrationNumber={data.registrationNumber}
                />
              ))}
            </div>
          </>
        )}
      </main>
      <BottomBar />
    </div>
  );
}

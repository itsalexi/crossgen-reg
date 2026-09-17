import type { Metadata } from "next";
import Image from "next/image";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { EVENT } from "@convex/shared";
import { BottomBar, PcecMark, TopBar } from "@/components/brand";
import { qrDataUrl } from "@/components/DoorPass";

/**
 * A sponsor's ticket.
 *
 * One code for the whole organization, because the seats were bought before
 * anybody knew who would use them. Whoever turns up holding this gives their
 * name at the door and takes the next free seat.
 *
 * Carries no names — there are none to carry — so unlike an attendee's pass
 * there is nothing here to leak. It is still kept out of search results: a
 * ticket is a ticket.
 */
export const metadata: Metadata = {
  title: "Sponsor ticket",
  robots: { index: false, follow: false },
  openGraph: { images: [] },
};

export default async function SponsorPage({
  params,
}: PageProps<"/sponsor/[number]">) {
  const { number } = await params;
  const pool = await fetchQuery(api.sponsors.pool, {
    registrationNumber: number,
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar right={<PcecMark />} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
        {pool === null ? (
          <>
            <h1 className="font-display text-[24px] font-semibold text-ink">
              We can&rsquo;t find that ticket
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Check the link, or give the name of your organization at the
              registration table on the day. That always works.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-[26px] leading-tight font-bold text-ink">
              Show this at the door
            </h1>
            <p className="mt-2 mb-6 text-[15px] leading-relaxed text-muted">
              Screenshot it. Anyone coming on {pool.org}&rsquo;s seats can use
              the same code — give your name at the registration table and you
              are in.
            </p>

            <article className="flex break-inside-avoid flex-col items-center gap-4 rounded-2xl border-2 border-line bg-white px-5 py-6 text-center">
              <div>
                <p className="font-display text-[22px] leading-[1.15] font-bold text-ink">
                  {pool.org}
                </p>
                <p className="mt-1 text-[14px] text-muted">
                  {pool.seats} {pool.seats === 1 ? "seat" : "seats"}
                </p>
              </div>

              <Image
                src={await qrDataUrl(pool.registrationNumber)}
                alt={`Check-in code for ${pool.org}`}
                width={220}
                height={220}
                unoptimized
                className="size-[220px]"
              />

              <p className="text-[13px] text-faint">
                {pool.registrationNumber} · {EVENT.dayOfWeek}, {EVENT.date} ·{" "}
                {EVENT.venue}
              </p>
            </article>

            <p className="mt-6 text-[14px] leading-relaxed text-muted">
              {EVENT.dayOfWeek}, {EVENT.date}, {EVENT.startTime} at{" "}
              {EVENT.venue}, {EVENT.address}. Everyone is in the plenary, the
              Worship Hall.
            </p>
          </>
        )}
      </main>
      <BottomBar />
    </div>
  );
}

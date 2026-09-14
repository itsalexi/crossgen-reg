import Image from "next/image";
import { EVENT } from "@convex/shared";
import { BottomBar, PcecMark, TopBar } from "./brand";
import { Eyebrow } from "./ui";

/**
 * What everyone sees once the form stops taking people.
 *
 * Deliberately still carries the date, the venue and the time: most of the
 * traffic here after closing is people who already registered coming back to
 * check where and when, not people trying to sign up. Turning the page into a
 * bare "closed" notice would send all of them to Facebook to ask.
 */
export function RegistrationClosed() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        right={
          <div className="flex items-center gap-3">
            <PcecMark />
            <span className="hidden text-[12.5px] leading-tight font-medium text-muted sm:block">
              PCEC Family Commission
            </span>
          </div>
        }
      />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[880px]">
          <Image
            src="/brand/header.png"
            alt="CrossGen Family Summit 2026 — Pamilyang Sama-Sama, Henerasyong Nagkaka-isa"
            width={2000}
            height={420}
            priority
            sizes="(min-width: 880px) 880px, 100vw"
            className="h-auto w-full sm:rounded-b-2xl"
          />

          <div className="flex flex-col gap-7 px-6 py-10 sm:px-10 sm:py-12">
            <div className="flex flex-col gap-3">
              <Eyebrow>Registration is closed</Eyebrow>
              <h1 className="font-display text-[2rem] leading-[1.1] font-bold tracking-[-0.03em] text-ink sm:text-[2.5rem]">
                Maraming salamat sa lahat ng nag-register!
              </h1>
              <p className="text-[16.5px] leading-relaxed text-muted">
                Punong-puno na po tayo, and we cannot wait to see your families
                on the day. Salamat sa inyong pagtitiwala at sa pag-uwi ng
                buong pamilya sa CrossGen.
              </p>
            </div>

            <dl className="flex flex-col gap-5 border-y border-line py-6 sm:flex-row sm:gap-10">
              <div className="flex flex-col gap-1">
                <Eyebrow>When</Eyebrow>
                <dd className="text-[15px] font-medium text-ink">
                  {EVENT.dayOfWeek}, {EVENT.date}
                </dd>
                <dd className="text-[14px] text-muted">
                  {EVENT.startTime} to {EVENT.endTime}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:border-l sm:border-line sm:pl-10">
                <Eyebrow>Where</Eyebrow>
                <dd className="text-[15px] font-medium text-ink">
                  {EVENT.venue}
                </dd>
                <dd className="text-[14px] text-muted">{EVENT.address}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[15px] font-semibold text-ink">
                  Naka-register na po kayo?
                </h2>
                <p className="text-[15px] leading-relaxed text-muted">
                  Hanapin niyo lang po ang confirmation email namin. Naroon ang
                  inyong registration number at ang listahan ng mga kasama
                  niyo. Dalhin niyo po iyon sa registration table sa mismong
                  araw.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="text-[15px] font-semibold text-ink">
                  Hindi po kayo nakaabot?
                </h2>
                <p className="text-[15px] leading-relaxed text-muted">
                  Message niyo po kami sa Facebook. Hindi po namin masisiguro
                  ang puwesto, pero tutulungan namin kayo kung ano pa ang
                  magagawa.
                </p>
              </div>
            </div>

            <p className="border-t border-line pt-6 text-[14px] leading-relaxed text-faint">
              {EVENT.verse}
            </p>
          </div>
        </div>
      </main>

      <BottomBar />
    </div>
  );
}

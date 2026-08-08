import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import {
  CrossGenWordmark,
  PcecMark,
  SiteFooter,
  SiteHeader,
} from "@/components/brand";
import {
  BREAKOUT_SESSIONS,
  EVENT,
  formatPeso,
  GROUP_RATE,
  GROUP_THRESHOLD,
  PAYMENT_ACCOUNT,
  REGULAR_RATE,
} from "@convex/shared";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" aria-hidden="true">
      <rect
        x="2.75"
        y="4.25"
        width="14.5"
        height="13"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M2.75 8.25h14.5M6.75 2.75v3M13.25 2.75v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" aria-hidden="true">
      <path
        d="M10 17.5s5.5-4.4 5.5-9a5.5 5.5 0 1 0-11 0c0 4.6 5.5 9 5.5 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" aria-hidden="true">
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.75 16.25c0-2.9 2.35-4.75 5.25-4.75s5.25 1.85 5.25 4.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14 5.4a2.9 2.9 0 0 1 0 5.2M15.5 16.25c0-1.5-.4-2.8-1.1-3.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="cg-hero-weave relative overflow-hidden">
          <div className="relative mx-auto w-full max-w-5xl px-5 py-20 sm:py-28">
            <p className="text-sm font-medium text-cg-gold">{EVENT.tagline}</p>

            <h1 className="mt-5">
              <CrossGenWordmark className="text-[2.6rem] sm:text-[3.4rem]" />
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              One day for families across every generation — worship, teaching,
              and breakout sessions built for where your family actually is.
            </p>

            <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-4 text-white/90">
              <div className="flex items-center gap-2.5">
                <CalendarIcon />
                <div>
                  <dt className="sr-only">Date</dt>
                  <dd className="text-[15px] font-semibold">
                    {EVENT.date}
                    <span className="ml-1.5 font-normal text-white/60">
                      ({EVENT.dayOfWeek})
                    </span>
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <PinIcon />
                <div>
                  <dt className="sr-only">Venue</dt>
                  <dd className="text-[15px] font-semibold">
                    {EVENT.venue}
                    <span className="ml-1.5 font-normal text-white/60">
                      {EVENT.address}
                    </span>
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <UsersIcon />
                <div>
                  <dt className="sr-only">Age requirement</dt>
                  <dd className="text-[15px] font-semibold">
                    {EVENT.minAge} years old and above
                  </dd>
                </div>
              </div>
            </dl>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="inline-flex h-[52px] items-center rounded-xl bg-cg-gold px-8 text-base font-semibold text-ink shadow-lg shadow-black/20 transition-colors hover:bg-cg-gold-soft"
              >
                Register now
              </Link>
              <a
                href="#fees"
                className="text-[15px] font-medium text-white/75 underline-offset-4 hover:text-white hover:underline"
              >
                See registration fees
              </a>
            </div>

            <p className="mt-10 max-w-2xl border-l-2 border-cg-gold/60 pl-4 text-sm leading-relaxed text-white/60 italic">
              {EVENT.verse}
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------ fees */}
        <section id="fees" className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20">
          <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            Registration fees
          </h2>
          <p className="mt-2 text-[15px] text-muted">
            The group rate applies automatically once a single registration has{" "}
            {GROUP_THRESHOLD} or more participants.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-7">
              <p className="text-[11.5px] font-semibold tracking-[0.09em] text-muted uppercase">
                Regular
              </p>
              <p className="mt-3 font-display text-4xl font-bold text-ink">
                {formatPeso(REGULAR_RATE)}
                <span className="ml-1 text-base font-medium text-muted">
                  / person
                </span>
              </p>
              <p className="mt-3 text-[15px] text-muted">
                1 to {GROUP_THRESHOLD - 1} participants on one registration.
              </p>
            </div>

            <div className="relative rounded-2xl border-2 border-cg-gold bg-cg-gold-tint p-7">
              <span className="absolute -top-3 left-7 rounded-full bg-cg-gold px-3 py-1 text-[11.5px] font-bold text-ink">
                BEST VALUE
              </span>
              <p className="text-[11.5px] font-semibold tracking-[0.09em] text-[#8a6800] uppercase">
                Group
              </p>
              <p className="mt-3 font-display text-4xl font-bold text-ink">
                {formatPeso(GROUP_RATE)}
                <span className="ml-1 text-base font-medium text-[#8a6800]">
                  / person
                </span>
              </p>
              <p className="mt-3 text-[15px] text-[#7a5c00]">
                {GROUP_THRESHOLD} or more participants on one registration.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-cg-blue/25 bg-cg-blue-tint p-4 text-sm leading-relaxed text-ink">
            <span className="font-semibold">
              Speakers, volunteers, and sponsors
            </span>{" "}
            register free — choose that registration type and the payment step is
            skipped entirely. Each registration has one type, so a family with a
            volunteer in it files two separate registrations.
          </div>
        </section>

        {/* -------------------------------------------------------- breakouts */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20">
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              Breakout sessions
            </h2>
            <p className="mt-2 text-[15px] text-muted">
              Every participant picks exactly one.
            </p>

            <ol className="mt-8 grid gap-3 sm:grid-cols-2">
              {BREAKOUT_SESSIONS.map((session) => (
                <li
                  key={session.value}
                  className="flex gap-4 rounded-2xl border border-line bg-white p-5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cg-purple-tint font-display text-sm font-bold text-cg-purple">
                    {session.value}
                  </span>
                  <p className="text-[15px] leading-relaxed font-medium text-ink">
                    {session.title}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------- payment */}
        <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20">
          <div className="grid gap-10 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                Where to send payment
              </h2>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">
                Deposit or transfer the total shown at the end of the form, then
                upload your proof of payment as part of your registration.
              </p>

              <dl className="mt-7 max-w-md divide-y divide-line rounded-2xl border border-line">
                {[
                  ["Bank", PAYMENT_ACCOUNT.bank],
                  ["Account name", PAYMENT_ACCOUNT.accountName],
                  ["Branch", PAYMENT_ACCOUNT.branch],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <dt className="text-sm text-muted">{label}</dt>
                    <dd className="text-sm font-semibold text-ink">{value}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <dt className="text-sm text-muted">Account number</dt>
                  <dd className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-semibold tracking-wide text-ink">
                      {PAYMENT_ACCOUNT.accountNumber}
                    </span>
                    <CopyButton value={PAYMENT_ACCOUNT.accountNumber} />
                  </dd>
                </div>
              </dl>

              <p className="mt-4 max-w-md text-[13px] leading-relaxed text-muted">
                We record the proof of payment you submit. We do not verify it
                automatically — the CrossGen team reviews payments separately.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-white p-7 sm:w-64">
              <PcecMark />
              <p className="mt-5 text-[13px] leading-relaxed text-muted">
                CrossGen Family Summit is organized by the PCEC Family
                Commission.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- cta */}
        <section className="bg-cg-purple">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-5 py-14 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                Ready to register?
              </h2>
              <p className="mt-1.5 text-[15px] text-white/70">
                Sign in with Google — it takes a few minutes.
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex h-[52px] shrink-0 items-center rounded-xl bg-cg-gold px-8 text-base font-semibold text-ink transition-colors hover:bg-cg-gold-soft"
            >
              Start registration
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

"use client";

import { EVENT } from "@convex/shared";
import { AccountBar, BottomBar, TopBar } from "./brand";
import { Eyebrow } from "./ui";

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "What we ask for",
    body: (
      <>
        For each person: name, nickname, age, gender, marital status, church or
        organization, how they serve there, work or study, mobile number, email,
        city or town, and the session they&rsquo;re joining. If there&rsquo;s a
        fee, we also keep the reference number, the date paid, and the photo of
        the receipt you attach.
      </>
    ),
  },
  {
    heading: "What we do with it",
    body: (
      <>
        Your registration, keeping you posted before and after the day, sorting
        out the breakout sessions, and looking after everyone while they&rsquo;re
        with us. Nothing else.
      </>
    ),
  },
  {
    heading: "Who sees it",
    body: (
      <>
        Only the CrossGen organizing team. Your own registration is visible to
        you whenever you sign in with the same Google account you used.
      </>
    ),
  },
  {
    heading: "About the receipt",
    body: (
      <>
        We keep it so the team can match payments by hand. Nothing is checked
        automatically, and us receiving it isn&rsquo;t the same as the payment
        having cleared.
      </>
    ),
  },
  {
    heading: "Anything else",
    body: <>Reply to your confirmation email and the team will help.</>,
  },
];

export function PrivacyScreen() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar right={<AccountBar />} />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[680px] px-5 py-12 sm:py-16">
          <Eyebrow>{EVENT.name}</Eyebrow>
          <h1 className="mt-3 font-display text-[30px] leading-tight font-bold text-ink sm:text-[38px]">
            What we do with your details
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-muted text-pretty">
            Short version: we only use what you give us to run this one event,
            and only the organizing team sees it.
          </p>

          <div className="mt-10 flex flex-col">
            {SECTIONS.map((section) => (
              <section
                key={section.heading}
                className="border-t border-line py-6 last:border-b"
              >
                <h2 className="font-display text-[18px] font-semibold text-ink">
                  {section.heading}
                </h2>
                <p className="mt-2 text-[15.5px] leading-relaxed text-muted text-pretty">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </div>
      </main>

      <BottomBar />
    </div>
  );
}

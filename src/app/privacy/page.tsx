import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { EVENT } from "@convex/shared";

export const metadata: Metadata = {
  title: "Privacy notice",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-5 py-14">
          <h1 className="font-display text-3xl font-bold text-ink">
            Privacy notice
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            For registrations to the {EVENT.name}.
          </p>

          <div className="mt-9 flex flex-col gap-7 text-[15px] leading-relaxed text-ink">
            <section>
              <h2 className="font-display text-lg font-bold">
                What we collect
              </h2>
              <p className="mt-2 text-muted">
                Name, preferred name, age, gender, marital status, church or
                organization, ministry involvement, occupation, mobile number,
                email address, city or municipality, and chosen breakout session
                for each participant. For paying registrations we also collect a
                payment reference number, date paid, and the proof of payment
                file you upload.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold">
                How we use it
              </h2>
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-muted">
                <li>Processing your registration</li>
                <li>Event communication before and after the summit</li>
                <li>Breakout session assignment</li>
                <li>Participant care during the event</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold">Who can see it</h2>
              <p className="mt-2 text-muted">
                Access is limited to authorized CrossGen organizers. Your own
                registration is visible to you when signed in with the Google
                account you used to register.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold">
                About payment proof
              </h2>
              <p className="mt-2 text-muted">
                Uploaded proof of payment is stored so organizers can reconcile
                payments manually. This system does not verify payments
                automatically, and receiving your upload is not confirmation that
                a payment has cleared.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold">Questions</h2>
              <p className="mt-2 text-muted">
                Reply to your confirmation email and the CrossGen team will help.
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

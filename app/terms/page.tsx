import { Metadata } from "next";
import PublicShell from "@/components/ui/PublicShell";
import PublicHero from "@/components/ui/PublicHero";
import { Card } from "@/components/ui/Card";
import { SUPPORT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <PublicShell>
      <PublicHero
        title="Terms of Service"
        description="The terms that govern using KingsHire as a client or Kinglancer."
      />
      <section className="px-4 py-10 sm:px-6">
        <Card className="mx-auto max-w-3xl p-6 sm:p-8">
          <p className="mb-10 text-sm text-slate-400">
            Last updated: 7 September 2026
          </p>

          <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                1. About KingsHire
              </h2>
              <p>
                KingsHire is a community marketplace that connects clients who
                need work done with skilled freelancers
                (&quot;Kinglancers&quot;), and lets organisations run shared
                hiring workspaces for their teams. By creating an account or
                using KingsHire, you agree to these Terms of Service and our
                Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                2. Eligibility
              </h2>
              <p>
                You must be at least 18 years old to register and use KingsHire,
                whether as an individual or on behalf of an organisation. By
                signing up you confirm that you are able to enter into a binding
                agreement and that the information you provide is accurate and
                complete.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                3. Accounts and roles
              </h2>
              <p>
                You may use a single account as a client (posting work), a
                Kinglancer (doing work), or both. Organisations are shared
                workspaces operated by their members; when you act within an
                organisation you do so on its behalf and with its authority. You
                are responsible for keeping your login details secure and for
                all activity under your account, and you must not share your
                credentials. KingsHire may suspend or terminate accounts that
                breach these terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                4. Jobs, fees and payments
              </h2>
              <p>
                All payments are processed securely through Stripe. KingsHire
                charges a service fee on each job: 2.5% from the client and 5%
                from the Kinglancer (a total platform fee of 7.5%). A £10
                minimum applies to each job. Some payment options require an
                active subscription; you can always pay by bank transfer at no
                extra card fee. Client funds are held in escrow until the client
                confirms satisfactory completion of the work. If the client does
                not respond, funds are released to the Kinglancer automatically
                five working days after the work is marked complete. Disputes
                must be raised within 7 days of completion. Kinglancers are paid
                out through automatic Stripe payouts or a payout link they
                control.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                5. Subscriptions
              </h2>
              <p>
                Some features are offered through optional paid subscriptions:
                individual client and Kinglancer plans (£5 per month) and
                organisation plans (Starter £15, Growth £25 and Scale £40 per
                month). Subscriptions are billed monthly in advance through
                Stripe and renew automatically until cancelled. You can cancel
                at any time, effective at the end of the current billing period,
                from the billing portal. Subscription fees are non-refundable
                except where required by law, and we may change plan pricing or
                features with reasonable notice.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                6. Placements and the Placement Passport
              </h2>
              <p>
                Organisations may offer supervised experience placements. Some
                placements are unpaid or non-monetary, while others are paid
                monthly through KingsHire-managed escrow on the same principles
                as paid jobs. Completing a placement may produce a verified
                experience record (a &quot;Placement Passport&quot; entry) shown
                on your profile. Placements are learning and experience
                opportunities; they are not a guarantee of future work or
                employment, and they are distinct from paid jobs.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                7. Prohibited Conduct
              </h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Post false, misleading, or fraudulent listings</li>
                <li>Harass, abuse, or discriminate against other users</li>
                <li>
                  Circumvent the platform to avoid service fees or subscriptions
                </li>
                <li>
                  Misrepresent your identity, organisation, or placement
                  affiliations
                </li>
                <li>Use the platform for any unlawful purpose</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                8. Intellectual Property
              </h2>
              <p>
                All content you upload (profile information, portfolio links,
                messages) remains yours. By posting it you grant KingsHire a
                limited licence to display it within the platform. KingsHire
                owns all platform code, design, and branding.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                9. Limitation of Liability
              </h2>
              <p>
                KingsHire acts as an intermediary and is not a party to
                agreements between clients, Kinglancers, or organisations. We
                are not liable for the quality of work, the outcome of
                placements, disputes between users, or any indirect or
                consequential losses arising from use of the platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                10. Changes to These Terms
              </h2>
              <p>
                We may update these terms from time to time. Where changes are
                material (for example, changes to fees), we will ask you to
                accept the updated terms before you continue using paid
                features, and we will notify registered users by email.
                Continued use of KingsHire after changes take effect constitutes
                acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                11. Governing Law
              </h2>
              <p>
                These terms are governed by the laws of England and Wales. Any
                disputes shall be subject to the exclusive jurisdiction of the
                courts of England and Wales.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">
                12. Contact
              </h2>
              <p>
                Questions about these terms? Email us at{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-blue-600 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>
          </div>
        </Card>
      </section>
    </PublicShell>
  );
}

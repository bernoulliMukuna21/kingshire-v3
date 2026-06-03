import { Metadata } from "next";
import PublicShell from "@/components/ui/PublicShell";
import PublicHero from "@/components/ui/PublicHero";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <PublicShell>
      <PublicHero
        title="Privacy Policy"
        description="How KingsHire collects, uses, and protects your personal data."
      />
      <section className="px-4 py-10 sm:px-6">
        <Card className="mx-auto max-w-3xl p-6 sm:p-8">
          <p className="mb-10 text-sm text-slate-400">
            Last updated: 15 May 2026
          </p>

          <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              1. Who We Are
            </h2>
            <p>
              KingsHire (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a
              community marketplace platform. This Privacy Policy explains what
              personal data we collect, how we use it, and your rights in
              relation to it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              2. Data We Collect
            </h2>
            <p>When you register and use KingsHire, we may collect:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Name, email address, and phone number</li>
              <li>Profile information (services, bio, location, rates)</li>
              <li>Portfolio URLs and CV links you choose to share</li>
              <li>Job postings, applications, and messages</li>
              <li>
                Payment information (processed by Stripe — we do not store card
                details)
              </li>
              <li>Usage data and device information for analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              3. How We Use Your Data
            </h2>
            <p>We use your data to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Provide and operate the KingsHire platform</li>
              <li>Connect clients with Kinglancers</li>
              <li>Process payments and manage escrow</li>
              <li>
                Send transactional emails (account confirmations, job updates)
              </li>
              <li>Investigate disputes and enforce our Terms of Service</li>
              <li>Improve the platform and user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              4. Who We Share Data With
            </h2>
            <p>
              We share data only where necessary to deliver the service. This
              includes:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Supabase</strong> — our database and authentication
                provider
              </li>
              <li>
                <strong>Stripe</strong> — payment processing
              </li>
              <li>
                Other users — your public profile (name, services, rating) is
                visible to registered community members
              </li>
            </ul>
            <p className="mt-2">
              We do not sell your personal data to any third party.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              5. Data Retention
            </h2>
            <p>
              We retain your data for as long as your account is active or as
              required by law. You may request deletion of your account at any
              time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              6. Your Rights
            </h2>
            <p>Under UK GDPR, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Port your data to another service</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact us at{" "}
              <a
                href="mailto:hello@kingshire.app"
                className="text-blue-600 hover:underline"
              >
                hello@kingshire.app
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              7. Cookies
            </h2>
            <p>
              KingsHire uses cookies solely for authentication (session
              management via Supabase). We do not use advertising or tracking
              cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify registered users of significant changes by email.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              9. Contact
            </h2>
            <p>
              Questions about your privacy? Email us at{" "}
              <a
                href="mailto:hello@kingshire.app"
                className="text-blue-600 hover:underline"
              >
                hello@kingshire.app
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

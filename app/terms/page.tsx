import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-10"
        >
          <ArrowLeft size={14} /> Back to home
        </Link>

        <h1 className="text-3xl font-black text-gray-900 mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: 15 May 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              1. About KingsHire
            </h2>
            <p>
              KingsHire is a community marketplace that connects clients who
              need work done with skilled freelancers (&quot;Kinglancers&quot;)
              within trusted local communities. By creating an account, you
              agree to these Terms of Service and our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              2. Eligibility
            </h2>
            <p>
              You must be at least 18 years old and a member of a recognised
              community (such as a church, neighbourhood group, or similar
              organisation) to register on KingsHire. By signing up you confirm
              that the information you provide is accurate and complete.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              3. User Accounts
            </h2>
            <p>
              You are responsible for maintaining the security of your account
              credentials. You must not share your login details with any third
              party. KingsHire reserves the right to suspend or terminate
              accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              4. Jobs and Payments
            </h2>
            <p>
              All payments are processed securely through Stripe. KingsHire
              charges a 5% platform fee on completed jobs. Funds are held in
              escrow until the client confirms satisfactory completion of the
              work. Disputes must be raised within 7 days of job completion.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              5. Prohibited Conduct
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Post false, misleading, or fraudulent listings</li>
              <li>Harass, abuse, or discriminate against other users</li>
              <li>Circumvent the platform to avoid service fees</li>
              <li>Use the platform for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              6. Intellectual Property
            </h2>
            <p>
              All content you upload (profile information, portfolio links,
              messages) remains yours. By posting it you grant KingsHire a
              limited licence to display it within the platform. KingsHire owns
              all platform code, design, and branding.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              7. Limitation of Liability
            </h2>
            <p>
              KingsHire acts as an intermediary and is not party to agreements
              between clients and Kinglancers. We are not liable for the quality
              of work, disputes between users, or any indirect or consequential
              losses arising from use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              8. Changes to These Terms
            </h2>
            <p>
              We may update these terms from time to time. Continued use of
              KingsHire after changes are posted constitutes acceptance of the
              updated terms. We will notify registered users of material changes
              by email.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              9. Governing Law
            </h2>
            <p>
              These terms are governed by the laws of England and Wales. Any
              disputes shall be subject to the exclusive jurisdiction of the
              courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              10. Contact
            </h2>
            <p>
              Questions about these terms? Email us at{" "}
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
      </div>
    </div>
  );
}

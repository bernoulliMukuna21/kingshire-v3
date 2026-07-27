"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, fieldClasses } from "@/components/ui/Field";
import {
  ORGANISATION_PLANS,
  getOrganisationPlan,
  type OrganisationPlanId,
} from "@/modules/organisations/domain/plans";

type Step = "organisation" | "profile" | "plan" | "review";

type SetupForm = {
  name: string;
  organisation_type: string;
  website: string;
  location: string;
  country: string;
  registration_number: string;
  description: string;
  plan_id: OrganisationPlanId;
};

const DEFAULT_FORM: SetupForm = {
  name: "",
  organisation_type: "company",
  website: "",
  location: "",
  country: "United Kingdom",
  registration_number: "",
  description: "",
  plan_id: "starter",
};

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "organisation", label: "Organisation" },
  { id: "profile", label: "Profile" },
  { id: "plan", label: "Plan" },
  { id: "review", label: "Review" },
];

function Progress({ current }: { current: Step }) {
  const activeIndex = STEPS.findIndex((step) => step.id === current);
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Organisation setup progress">
      {STEPS.map((step, index) => (
        <li key={step.id}>
          <div
            className={`h-1.5 rounded-full ${
              index <= activeIndex ? "bg-blue-600" : "bg-slate-200"
            }`}
          />
          <p
            className={`mt-2 text-xs font-bold ${
              index <= activeIndex ? "text-blue-700" : "text-slate-400"
            }`}
          >
            {step.label}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function OrganisationSetupWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("organisation");
  const [form, setForm] = useState<SetupForm>(DEFAULT_FORM);
  const [requestKey, setRequestKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const cancelled = searchParams.get("cancelled") === "1";
  const cancelledDraftId = searchParams.get("draft_id");

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const saved = window.sessionStorage.getItem("kingshire-organisation-setup");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as {
            form?: Partial<SetupForm>;
            requestKey?: string;
          };
          setForm((current) => ({ ...current, ...parsed.form }));
          if (parsed.requestKey) setRequestKey(parsed.requestKey);
        } catch {
          window.sessionStorage.removeItem("kingshire-organisation-setup");
        }
      }
      setRequestKey((current) => current || window.crypto.randomUUID());
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!cancelled || !cancelledDraftId) return;
    const closeCheckout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/organisations/setup/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft_id: cancelledDraftId }),
        });
        if (response.ok) {
          setRequestKey(window.crypto.randomUUID());
        }
      } catch {
        // The existing Checkout Session remains resumable when cancellation
        // cannot be confirmed, avoiding accidental duplicate subscriptions.
      }
    }, 0);
    return () => window.clearTimeout(closeCheckout);
  }, [cancelled, cancelledDraftId]);

  useEffect(() => {
    if (!requestKey) return;
    window.sessionStorage.setItem(
      "kingshire-organisation-setup",
      JSON.stringify({ form, requestKey }),
    );
  }, [form, requestKey]);

  const selectedPlan = useMemo(
    () => getOrganisationPlan(form.plan_id),
    [form.plan_id],
  );

  function update<Key extends keyof SetupForm>(
    key: Key,
    value: SetupForm[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function next(nextStep: Step) {
    setError(null);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startCheckout() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/organisations/setup/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, request_key: requestKey }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to start secure checkout.");
        return;
      }
      if (result.organisationId) {
        window.sessionStorage.removeItem("kingshire-organisation-setup");
        router.push(
          `/organisation/setup/team?organisation_id=${result.organisationId}`,
        );
        return;
      }
      if (!result.checkoutUrl) {
        setError("Stripe did not provide a checkout page.");
        return;
      }
      window.location.assign(result.checkoutUrl);
    } catch {
      setError("Unable to reach secure checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-600">
          Set up your Organisation
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Build your shared KingsHire workspace
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">
          Your personal account stays yours. The Organisation gets its own
          profile, subscription, team and work history.
        </p>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-8">
        <Progress current={step} />

        {cancelled && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Checkout was not completed. Your setup details have been kept, and
            no Organisation has been activated.
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === "organisation" && (
          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              next("profile");
            }}
          >
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Tell us about your Organisation
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Start with the identity people will see when your Organisation
                publishes work.
              </p>
            </div>
            <Field
              label="Organisation name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
              minLength={2}
              maxLength={120}
            />
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <label
                htmlFor="organisation-type"
                className="block text-sm font-black text-slate-900"
              >
                What kind of Organisation is this?
              </label>
              <p className="mb-3 mt-1 text-xs leading-5 text-slate-600">
                This helps people understand who is publishing the opportunity.
              </p>
              <select
                id="organisation-type"
                className={fieldClasses}
                value={form.organisation_type}
                onChange={(event) =>
                  update("organisation_type", event.target.value)
                }
              >
                <option value="company">Company</option>
                <option value="charity">Charity</option>
                <option value="church">Church or ministry</option>
                <option value="non_profit">Non-profit</option>
                <option value="community_group">Community group</option>
                <option value="public_body">Public body</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="lg">
                Continue <ArrowRight size={18} />
              </Button>
            </div>
          </form>
        )}

        {step === "profile" && (
          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              next("plan");
            }}
          >
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Complete the public profile
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Optional information can be added or changed from the workspace
                later.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Website (optional)"
                type="url"
                value={form.website}
                onChange={(event) => update("website", event.target.value)}
              />
              <Field
                label="Location (optional)"
                value={form.location}
                onChange={(event) => update("location", event.target.value)}
              />
              <Field
                label="Country"
                value={form.country}
                onChange={(event) => update("country", event.target.value)}
                required
              />
              <Field
                label="Official registration number (optional)"
                value={form.registration_number}
                onChange={(event) =>
                  update("registration_number", event.target.value)
                }
                help="Companies House, Charity Commission or another official register."
              />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">
                Description (optional)
              </span>
              <textarea
                className={fieldClasses}
                rows={5}
                maxLength={1000}
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="What does your Organisation do?"
              />
            </label>
            <div className="flex justify-between">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => next("organisation")}
              >
                <ArrowLeft size={18} /> Back
              </Button>
              <Button type="submit" size="lg">
                Choose a plan <ArrowRight size={18} />
              </Button>
            </div>
          </form>
        )}

        {step === "plan" && (
          <div className="mt-8">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Choose your monthly plan
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ordinary paid jobs are unlimited on every plan. Placement
                capacities will be introduced with the placement product.
              </p>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {ORGANISATION_PLANS.map((plan) => {
                const selected = form.plan_id === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => update("plan_id", plan.id)}
                    className={`relative rounded-3xl border-2 p-5 text-left transition ${
                      selected
                        ? "border-blue-600 bg-blue-50 shadow-lg shadow-blue-900/10"
                        : "border-slate-200 bg-white hover:border-blue-300"
                    }`}
                    aria-pressed={selected}
                  >
                    {plan.highlighted && (
                      <span className="absolute right-4 top-4 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                        Popular
                      </span>
                    )}
                    <p className="font-black text-slate-950">{plan.name}</p>
                    <p className="mt-3 text-3xl font-black text-slate-950">
                      £{plan.monthlyPriceGBP}
                      <span className="text-sm font-semibold text-slate-500">
                        /month
                      </span>
                    </p>
                    <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">
                      {plan.description}
                    </p>
                    <ul className="mt-5 space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex gap-2 text-sm text-slate-700"
                        >
                          <Check
                            size={16}
                            className="mt-0.5 shrink-0 text-emerald-600"
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <span
                      className={`mt-6 flex items-center gap-2 text-sm font-black ${
                        selected ? "text-blue-700" : "text-slate-500"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          selected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-300"
                        }`}
                      >
                        {selected && <Check size={13} />}
                      </span>
                      {selected ? "Selected" : "Select plan"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex justify-between">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => next("profile")}
              >
                <ArrowLeft size={18} /> Back
              </Button>
              <Button type="button" size="lg" onClick={() => next("review")}>
                Review setup <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="mt-8">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Review and subscribe
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Stripe securely handles the subscription payment. You will
                become the Organisation Owner after confirmation.
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 p-5">
                <Building2 className="text-blue-700" size={24} />
                <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-400">
                  Organisation
                </p>
                <p className="mt-1 text-xl font-black text-slate-950">
                  {form.name}
                </p>
                <p className="mt-2 text-sm capitalize text-slate-600">
                  {form.organisation_type.replaceAll("_", " ")}
                  {form.location ? ` · ${form.location}` : ""}
                </p>
              </div>
              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
                <CreditCard className="text-blue-700" size={24} />
                <p className="mt-4 text-xs font-black uppercase tracking-wide text-blue-500">
                  Monthly subscription
                </p>
                <p className="mt-1 text-xl font-black text-slate-950">
                  {selectedPlan.name} · £{selectedPlan.monthlyPriceGBP}/month
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Recurring monthly until cancelled.
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <ShieldCheck
                className="mt-0.5 shrink-0 text-amber-700"
                size={22}
              />
              <div>
                <p className="font-black text-amber-950">
                  You will become the Organisation Owner
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-900/80">
                  The Owner controls billing, members, deletion and the entire
                  workspace. Ownership can be transferred later.
                </p>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
              <input
                type="checkbox"
                checked={authorityConfirmed}
                onChange={(event) =>
                  setAuthorityConfirmed(event.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm leading-6 text-slate-700">
                I confirm that I am authorised to create and manage this
                Organisation and understand that the selected plan renews
                monthly until cancelled.
              </span>
            </label>

            <div className="mt-8 flex justify-between">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => next("plan")}
                disabled={loading}
              >
                <ArrowLeft size={18} /> Back
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={startCheckout}
                disabled={!authorityConfirmed || loading || !requestKey}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {loading ? "Opening Stripe…" : "Continue to secure payment"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

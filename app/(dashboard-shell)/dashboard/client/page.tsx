import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FadeIn } from "@/components/animations";
import PageHeader from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { getDashboardContext } from "@/lib/dashboard-context";
import {
  ClientActionCentreSection,
  ActionCentreSkeleton,
} from "./_sections/ClientActionCentreSection";
import {
  ClientMainSection,
  ClientMainSkeleton,
} from "./_sections/ClientMainSection";

export default async function ClientDashboard() {
  const { profile } = await getDashboardContext();

  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");
  if (profile.role !== "client") redirect("/onboarding");

  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <FadeIn>
        <PageHeader
          eyebrow="Client dashboard"
          title={`Welcome back, ${firstName} 👋`}
          description="Track your posted jobs, review applicants, and release payments from one place."
          action={
            <ButtonLink href="/jobs/post" variant="secondary">
              Post a job
            </ButtonLink>
          }
        />
      </FadeIn>

      <Suspense fallback={<ActionCentreSkeleton />}>
        <ClientActionCentreSection />
      </Suspense>

      <Suspense fallback={<ClientMainSkeleton />}>
        <ClientMainSection />
      </Suspense>
    </div>
  );
}

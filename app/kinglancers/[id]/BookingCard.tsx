"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getRoleHome } from "@/lib/roles";
import { createClient } from "@/lib/supabase/client";

type Props = {
  kinglancerId: string;
  kinglancerFirstName: string;
  bookingHref: string;
};

type ViewerState =
  | { ready: false }
  | { ready: true; userId: string | null; role: string | null };

export function BookingCard({
  kinglancerId,
  kinglancerFirstName,
  bookingHref,
}: Props) {
  const [viewer, setViewer] = useState<ViewerState>({ ready: false });

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setViewer({ ready: true, userId: null, role: null });
        return;
      }
      const [{ data: authData }, { data: profile }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single(),
      ]);
      setViewer({
        ready: true,
        userId: authData.user?.id ?? null,
        role: profile?.role ?? null,
      });
    })();
  }, []);

  // Show a neutral skeleton while auth resolves — avoids layout shift
  if (!viewer.ready) {
    return <div className="h-10 animate-pulse rounded-2xl bg-slate-100" />;
  }

  const { userId, role } = viewer;

  if (role === "admin") {
    return (
      <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        Admin accounts can inspect profiles but cannot book marketplace work.
      </p>
    );
  }

  if (userId === kinglancerId) {
    return (
      <ButtonLink href="/dashboard/profile" className="w-full sm:w-auto">
        Edit your profile
      </ButtonLink>
    );
  }

  if (role === "client") {
    return (
      <ButtonLink href={bookingHref} className="w-full sm:w-auto">
        Request this Kinglancer
      </ButtonLink>
    );
  }

  if (role === "kinglancer") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Switch to a client account before requesting another Kinglancer.
        </p>
        <ButtonLink
          href="/dashboard/settings"
          variant="secondary"
          className="w-full sm:w-auto"
        >
          Go to settings
        </ButtonLink>
      </div>
    );
  }

  if (userId) {
    // Logged in but no role set yet
    return (
      <ButtonLink href={getRoleHome(role)} className="w-full sm:w-auto">
        Complete client setup
      </ButtonLink>
    );
  }

  // Logged out
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <ButtonLink href="/sign-up" className="w-full sm:w-auto">
        Sign up to request
      </ButtonLink>
      <ButtonLink
        href="/sign-in"
        variant="secondary"
        className="w-full sm:w-auto"
      >
        Sign in
      </ButtonLink>
    </div>
  );
}

export function BookingCardWrapper({
  kinglancerId,
  kinglancerFirstName,
  bookingHref,
}: Props) {
  return (
    <>
      {/* Mobile card */}
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:hidden">
        <Card className="p-6">
          <h2 className="text-lg font-black text-slate-950">
            Work with {kinglancerFirstName}
          </h2>
          <p className="mb-5 mt-2 text-sm leading-6 text-slate-500">
            Send a private job request. They can accept, decline, or suggest
            changes before you fund escrow.
          </p>
          <BookingCard
            kinglancerId={kinglancerId}
            kinglancerFirstName={kinglancerFirstName}
            bookingHref={bookingHref}
          />
        </Card>
      </div>

      {/* Desktop sidebar card — rendered inline via the page layout */}
    </>
  );
}

type AppliedBannerProps = {
  kinglancerId: string;
  kinglancerFirstName: string;
};

export function AppliedToYourJobsBanner({
  kinglancerId,
  kinglancerFirstName,
}: AppliedBannerProps) {
  const [jobs, setJobs] = useState<
    { jobId: string; jobTitle: string }[] | null
  >(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "client") return;

      const { data: applications } = await supabase
        .from("applications")
        .select("job_id, job:jobs!job_id(id, title, client_id)")
        .eq("kinglancer_id", kinglancerId)
        .in("status", ["pending", "accepted"]);

      type AppWithJob = {
        job_id: string;
        job: { id: string; title: string; client_id: string } | null;
      };

      const matched = ((applications ?? []) as unknown as AppWithJob[])
        .filter((a) => a.job?.client_id === session.user.id)
        .map((a) => ({ jobId: a.job!.id, jobTitle: a.job!.title }));

      if (matched.length > 0) setJobs(matched);
    })();
  }, [kinglancerId]);

  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-1.5">
      <p className="text-sm font-bold text-blue-900">
        {kinglancerFirstName} has applied for your job
        {jobs.length > 1 ? "s" : ""}
      </p>
      {jobs.map(({ jobId, jobTitle }) => (
        <a
          key={jobId}
          href={`/jobs/${jobId}`}
          className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline font-medium"
        >
          &rarr; {jobTitle}
        </a>
      ))}
    </div>
  );
}

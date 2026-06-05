"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import PostJobFormLoader from "@/app/(dashboard-shell)/jobs/post/PostJobFormLoader";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

type PreferredKinglancer = {
  id: string;
  fullName: string;
  serviceTags: string[];
  avatarUrl: string | null;
};

export default function RequestView({
  kinglancer,
}: {
  kinglancer: PreferredKinglancer;
}) {
  const [submitted, setSubmitted] = useState(false);
  const firstName = kinglancer.fullName.split(" ")[0];

  if (submitted) {
    return (
      <Card className="p-8 text-center space-y-5">
        <div className="flex justify-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </span>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-slate-900">
            Request sent to {firstName}!
          </h2>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            {firstName} will review your request and respond. You&apos;ll be
            notified when they do.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center pt-2">
          <ButtonLink href="/kinglancers">Browse more Kinglancers</ButtonLink>
          <ButtonLink href="/dashboard/client/jobs" variant="secondary">
            View your requests
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <PostJobFormLoader
        preferredKinglancer={kinglancer}
        onSuccess={() => setSubmitted(true)}
      />
    </Card>
  );
}

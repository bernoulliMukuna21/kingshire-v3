"use client";

import dynamic from "next/dynamic";
import { FormSkeleton } from "./PostJobForm";

const PostJobForm = dynamic(() => import("./PostJobForm"), {
  ssr: false,
  loading: () => <FormSkeleton />,
});

type PreferredKinglancer = {
  id: string;
  fullName: string;
  serviceTags: string[];
  avatarUrl: string | null;
};

export default function PostJobFormLoader({
  preferredKinglancer,
  onSuccess,
  organisations,
  attachmentOrganisationIds,
}: {
  preferredKinglancer?: PreferredKinglancer | null;
  onSuccess?: () => void;
  organisations?: { id: string; name: string }[];
  attachmentOrganisationIds?: string[];
}) {
  return (
    <PostJobForm
      preferredKinglancer={preferredKinglancer}
      onSuccess={onSuccess}
      organisations={organisations}
      attachmentOrganisationIds={attachmentOrganisationIds}
    />
  );
}

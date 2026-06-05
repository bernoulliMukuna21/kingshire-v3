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
}: {
  preferredKinglancer?: PreferredKinglancer | null;
  onSuccess?: () => void;
}) {
  return (
    <PostJobForm
      preferredKinglancer={preferredKinglancer}
      onSuccess={onSuccess}
    />
  );
}

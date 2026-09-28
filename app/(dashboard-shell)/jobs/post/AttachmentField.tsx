"use client";

import {
  JOB_ATTACHMENT_ACCEPT,
  jobAttachmentError,
} from "@/lib/job-attachments";

export function AttachmentField({
  organisationId,
  attachmentFile,
  setAttachmentFile,
  attachmentError,
  setAttachmentError,
  loading,
}: {
  organisationId?: string;
  attachmentFile: File | null;
  setAttachmentFile: (file: File | null) => void;
  attachmentError: string | null;
  setAttachmentError: (error: string | null) => void;
  loading: boolean;
}) {
  return (
    <div>
      <label
        htmlFor="job-attachment"
        className="mb-1.5 block text-sm font-medium text-gray-700"
      >
        Full job description document{" "}
        <span className="font-normal text-gray-400">
          (optional, recommended)
        </span>
      </label>
      <p id="job-attachment-help" className="mb-2 text-xs text-gray-500">
        Upload the full job description, including responsibilities and
        requirements. PDF, Word or text, up to 3 MB. PDF is best for viewing in
        a browser. Kinglancers and your Organisation can open it from the job
        details page. Anyone who can view the job can view this document.
      </p>
      <input
        key={`${organisationId ?? "personal"}-${attachmentFile ? "selected" : "empty"}`}
        id="job-attachment"
        type="file"
        accept={JOB_ATTACHMENT_ACCEPT}
        disabled={loading}
        aria-describedby="job-attachment-help"
        aria-invalid={!!attachmentError}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          const message = file ? jobAttachmentError(file) : null;
          setAttachmentError(message);
          setAttachmentFile(message ? null : file);
          if (message) e.target.value = "";
        }}
        className="block w-full rounded-xl border border-gray-200 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700"
      />
      {attachmentFile && (
        <p className="mt-2 break-words text-sm text-gray-600">
          {attachmentFile.name}{" "}
          <button
            type="button"
            disabled={loading}
            className="font-semibold text-blue-700"
            onClick={() => {
              setAttachmentFile(null);
              setAttachmentError(null);
            }}
          >
            Remove
          </button>
        </p>
      )}
      {attachmentError && (
        <p role="alert" className="mt-1 text-xs text-red-500">
          {attachmentError}
        </p>
      )}
    </div>
  );
}

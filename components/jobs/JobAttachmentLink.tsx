import { Paperclip } from "lucide-react";
import { parseJobAttachment } from "@/lib/job-attachments";

export default function JobAttachmentLink({ jobId, attachment }: {
  jobId: string;
  attachment: unknown;
}) {
  const file = parseJobAttachment(attachment);
  if (!file) return null;
  return (
    <a href={`/api/jobs/${jobId}/attachment`} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">
      <Paperclip size={18} className="shrink-0" />
      <span className="min-w-0 break-words">View job description document: {file.name}<span className="mt-1 block text-xs font-normal">Opens in a new tab · Word files may download</span></span>
      <span className="shrink-0 text-xs font-normal">{Math.max(1, Math.ceil(file.size / 1024))} KB</span>
    </a>
  );
}

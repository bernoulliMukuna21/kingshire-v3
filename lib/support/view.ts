import { z } from "zod";
import { isValidEmailAddress, normalizeEmail } from "@/lib/validation";

export const enquiryTopics = [
  "account",
  "payment",
  "demo",
  "feedback",
] as const;
export type EnquiryTopic = (typeof enquiryTopics)[number];
export const enquiryStatuses = ["new", "in_progress", "resolved"] as const;
export type EnquiryStatus = (typeof enquiryStatuses)[number];
export function deriveEnquiryView(topic: string, status = "new") {
  const topics: Record<
    string,
    { label: string; prompt: string; success: string }
  > = {
    account: {
      label: "Account help",
      prompt: "What do you need help with?",
      success:
        "Your request is with our team. We’ll reply to the email address you provided.",
    },
    payment: {
      label: "Job or payment help",
      prompt: "Tell us which job or payment you need help with",
      success:
        "Your request is with our team. We’ll reply to the email address you provided.",
    },
    demo: {
      label: "Request a demo",
      prompt: "Tell us about your organisation and what you’d like to see",
      success:
        "Your demo request is with our team. We’ll email you to arrange a time.",
    },
    feedback: {
      label: "Give feedback",
      prompt: "How has your experience with KingsHire been?",
      success:
        "Thank you. Your feedback has been saved for our team to review.",
    },
  };
  const statuses: Record<string, string> = {
    new: "New",
    in_progress: "In progress",
    resolved: "Resolved",
  };
  return {
    ...(topics[topic] ?? topics.account),
    statusLabel: statuses[status] ?? "Needs review",
  };
}
export function contactSource(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "";
  return value.split(/[?#]/)[0].slice(0, 300);
}
export function contactHref(topic: EnquiryTopic = "account", source = "") {
  if (topic === "feedback") return "/contact?topic=feedback";
  const query = new URLSearchParams({ topic });
  const safe = contactSource(source);
  if (safe) query.set("from", safe);
  return `/contact?${query}`;
}
export const enquirySchema = z
  .object({
    id: z.uuid(),
    topic: z.enum(enquiryTopics),
    name: z.string().trim().max(100),
    email: z.string().trim().max(254).transform(normalizeEmail),
    organisation: z.string().trim().max(160),
    reference: z.string().trim().max(120),
    message: z
      .string()
      .trim()
      .min(10, "Please tell us a little more (at least 10 characters).")
      .max(5000),
    sourcePath: z.string().max(1000).transform(contactSource),
    website: z.string().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.email && !isValidEmailAddress(value.email))
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Please enter a valid email address.",
      });
    if (value.topic !== "feedback") {
      if (!value.name)
        ctx.addIssue({
          code: "custom",
          path: ["name"],
          message: "Please enter your name.",
        });
      if (!value.email)
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "Please enter an email so we can reply.",
        });
    }
  });

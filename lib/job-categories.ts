export const JOB_CATEGORIES = [
  "Design & Creative",
  "Technology & IT",
  "Cleaning & Maintenance",
  "Photography & Video",
  "Teaching & Tutoring",
  "Music & Arts",
  "Catering & Food",
  "Admin & Office",
  "Construction & Trade",
  "Other",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];

/** Returns 1-2 uppercase initials from a full name, or "?" if absent. */
export function getInitials(fullName: string | null | undefined): string {
  return (
    fullName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?"
  );
}

export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

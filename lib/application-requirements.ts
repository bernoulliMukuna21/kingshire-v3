/** CVs are required for organisation roles; one-off and personal jobs keep applications lightweight. */
export function requiresApplicationCv(
  postingType: string,
  organisationId: string | null | undefined,
): boolean {
  return postingType === "role" && Boolean(organisationId);
}

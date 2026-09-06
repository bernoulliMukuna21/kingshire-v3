export type OrganisationErrorCode =
  | "invalid_input"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "expired"
  | "persistence_failure";

export class OrganisationError extends Error {
  constructor(
    public readonly code: OrganisationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OrganisationError";
  }
}

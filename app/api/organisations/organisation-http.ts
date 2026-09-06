import { NextResponse } from "next/server";
import { OrganisationError } from "@/modules/organisations/domain/errors";

const STATUS_BY_CODE = {
  invalid_input: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  expired: 410,
  persistence_failure: 500,
} as const;

export function organisationErrorResponse(error: unknown) {
  if (!(error instanceof OrganisationError)) return null;
  return NextResponse.json(
    { error: error.message },
    { status: STATUS_BY_CODE[error.code] },
  );
}

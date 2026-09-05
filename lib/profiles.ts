export type ProfileService = {
  name: string;
  rate: number;
  rate_type: string;
};

/** Narrow a profile's loosely-typed `services` jsonb column into typed entries. */
export function parseProfileServices(value: unknown): ProfileService[] {
  return Array.isArray(value) ? (value as ProfileService[]) : [];
}

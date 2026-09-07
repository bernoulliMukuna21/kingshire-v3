// Free UK postcode lookup via postcodes.io (no API key). Server-side source of
// truth for a job's geocode + public area label — never trust client lat/lng.

export type PostcodeLookup = {
  postcode: string; // normalised, e.g. "S60 1AB"
  area: string; // public label, e.g. "Rotherham S60"
  latitude: number;
  longitude: number;
};

export async function lookupPostcode(
  raw: string,
): Promise<PostcodeLookup | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let res: Response;
  try {
    res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`,
      { cache: "no-store" },
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as {
    result?: {
      postcode?: string;
      admin_district?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    };
  } | null;

  const r = body?.result;
  if (!r?.postcode || r.latitude == null || r.longitude == null) return null;

  const outcode = r.postcode.split(" ")[0];
  const district = r.admin_district?.trim();
  return {
    postcode: r.postcode,
    area: district ? `${district} ${outcode}` : outcode,
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

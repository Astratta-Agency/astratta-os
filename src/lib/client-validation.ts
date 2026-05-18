import type { MediaAssetRow } from "@/hooks/useMediaAssets";

const HEALTHCARE_INDUSTRIES = new Set(["Med Spa", "Healthcare", "Wellness"]);

export function isHealthcareClient(
  client: { industry?: string | null } | null | undefined,
): boolean {
  if (!client?.industry) return false;
  return HEALTHCARE_INDUSTRIES.has(client.industry);
}

/**
 * Given the list of media URLs attached to a post and the corresponding asset
 * rows, return the file_names of any asset that requires consent but is not
 * yet signed. Empty list = OK to schedule/publish.
 */
export function assertConsentForMediaUrls(
  urls: string[],
  assets: MediaAssetRow[],
): string[] {
  if (!urls.length) return [];
  const byUrl = new Map(assets.map((a) => [a.public_url, a]));
  const missing: string[] = [];
  for (const u of urls) {
    const a = byUrl.get(u);
    if (a && a.consent_required && !a.consent_signed) {
      missing.push(a.file_name);
    }
  }
  return missing;
}

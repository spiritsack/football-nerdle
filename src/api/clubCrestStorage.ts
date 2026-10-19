/**
 * Club crest storage, shared by the Admin UI (browser client) and the logo
 * backfill script (service-role client): crests live in the public
 * `club-crests` bucket as `<clubId>.<ext>` and `clubs.badge` points at them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDuplicateClub } from "../pages/Admin/clubLogo";

const BUCKET = "club-crests";

/** Upload a crest and point the club's badge at it. Returns the public URL, or null on failure. */
export async function storeClubCrest(
  client: SupabaseClient,
  clubId: string,
  image: Blob,
  ext: string,
): Promise<string | null> {
  const path = `${clubId}.${ext}`;
  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(path, image, { upsert: true, contentType: image.type || undefined });
  if (uploadError) {
    console.error("storeClubCrest upload failed:", uploadError);
    return null;
  }

  const publicUrl = client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: updateError } = await client
    .from("clubs")
    .update({ badge: publicUrl })
    .eq("id", clubId);
  if (updateError) {
    console.error("storeClubCrest update failed:", updateError);
    return null;
  }
  return publicUrl;
}

/** The other half of a duplicate pair (same club under a sportsdb and a tm_ id), if it has no badge */
export async function findDuplicateClubsWithoutBadge(
  client: SupabaseClient,
  clubId: string,
  name: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("clubs")
    .select("id, name")
    .eq("badge", "")
    .neq("id", clubId)
    .ilike("name", name.replace(/[%_\\]/g, "\\$&"));
  if (error) {
    console.error("findDuplicateClubsWithoutBadge failed:", error);
    return [];
  }
  return (data ?? []).filter((c) => isDuplicateClub(c, { id: clubId, name })).map((c) => c.id);
}

/** Point each club's badge at an already stored crest. Returns the ids that were updated. */
export async function shareClubCrest(client: SupabaseClient, clubIds: string[], badgeUrl: string): Promise<string[]> {
  if (clubIds.length === 0) return [];
  const { data, error } = await client
    .from("clubs")
    .update({ badge: badgeUrl })
    .in("id", clubIds)
    .eq("badge", "")
    .select("id");
  if (error) {
    console.error("shareClubCrest failed:", error);
    return [];
  }
  return (data ?? []).map((c) => c.id);
}

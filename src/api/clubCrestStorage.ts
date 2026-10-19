/**
 * Club crest storage, shared by the Admin UI (browser client) and the logo
 * backfill script (service-role client): crests live in the public
 * `club-crests` bucket as `<clubId>.<ext>` and `clubs.badge` points at them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDuplicateClub } from "../pages/Admin/clubLogo";
import { downloadLogo } from "./clubLogoLookup";
import type { LogoLookup } from "./clubLogoLookup";

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

/**
 * Save a logo the lookup found (or a person accepted) for a club. A youth team
 * whose parent has a badge just points at the parent's crest, so a new parent
 * crest uploaded later reaches it too. Otherwise the image is downloaded into
 * the bucket as the club's crest (the parent's, for a youth team) and shared
 * with same-named duplicates without a badge. `alsoFilled`: the other clubs
 * that got the crest. Throws with a message the UI can show.
 */
export async function saveFoundLogo(
  client: SupabaseClient,
  club: { id: string; name: string },
  logo: LogoLookup & { imageUrl: string },
  headers?: HeadersInit,
): Promise<{ badge: string; alsoFilled: string[] }> {
  if (logo.parent?.badge) {
    const shared = await shareClubCrest(client, [club.id], logo.parent.badge);
    if (shared.length === 0) throw new Error("Couldn't point the badge at the parent's crest");
    return { badge: logo.parent.badge, alsoFilled: [] };
  }

  const owner = logo.parent ?? club;
  const { blob, ext } = await downloadLogo(logo.imageUrl, headers);
  const badge = await storeClubCrest(client, owner.id, blob, ext);
  if (!badge) throw new Error("Upload failed");
  const others = await findDuplicateClubsWithoutBadge(client, owner.id, owner.name);
  if (logo.parent) others.push(club.id);
  const alsoFilled = await shareClubCrest(client, others, badge);
  return { badge, alsoFilled: logo.parent ? [owner.id, ...alsoFilled.filter((id) => id !== club.id)] : alsoFilled };
}

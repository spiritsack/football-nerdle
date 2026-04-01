import { supabase } from "./supabaseClient";
import type { Player } from "../types";

interface SearchRow {
  id: string;
  name: string;
  thumbnail: string;
  countries: { name: string } | null;
}

export async function searchPlayers(query: string): Promise<Player[]> {
  if (!supabase || query.trim().length < 2) return [];

  const { data, error } = await supabase
    .from("players")
    .select("id, name, thumbnail, countries(name)")
    .ilike("name", `%${query}%`)
    .limit(15);

  if (error || !data) return [];

  return (data as unknown as SearchRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    thumbnail: row.thumbnail || "",
    nationality: row.countries?.name ?? "",
  }));
}

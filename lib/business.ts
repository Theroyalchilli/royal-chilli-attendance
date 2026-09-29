import supabase from "./supabase";
import { DEFAULT_BUSINESS_ID } from "./business-id";

// Several businesses share one database (royal-chilli-pos migration 076).
// Staff are shared; each login works for one business at a time. Mirrors the
// parts of royal-chilli-pos/lib/business.ts this app needs.

export { DEFAULT_BUSINESS_ID };

/** Active businesses this staff member works at, lowest id first. */
export async function staffBusinessIds(staffId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from("staff_businesses").select("business_id").eq("staff_id", staffId).eq("active", true).order("business_id");
  if (error) throw error;
  return (data ?? []).map((r) => r.business_id as number);
}

/** Which business a login works for: their first. null = not set up anywhere. */
export async function loginBusinessId(staffId: number): Promise<number | null> {
  return (await staffBusinessIds(staffId))[0] ?? null;
}

/** Ids of the (shared) staff who work at this business. */
export async function staffIdsAt(businessId: number): Promise<number[]> {
  const { data, error } = await supabase.from("staff_businesses").select("staff_id").eq("business_id", businessId).eq("active", true);
  if (error) throw error;
  return (data ?? []).map((r) => r.staff_id as number);
}

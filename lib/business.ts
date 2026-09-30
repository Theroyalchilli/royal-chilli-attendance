import supabase from "./supabase";
import { DEFAULT_BUSINESS_ID } from "./business-id";

// Several independent businesses share one database (royal-chilli-pos
// migrations 076–079). Each staff member belongs to exactly one business
// (staff.business_id); the group owner (staff.is_owner) belongs to none and
// can work in any. Mirrors royal-chilli-pos/lib/business.ts.

export { DEFAULT_BUSINESS_ID };

/** A staff member's business, and whether they're the group owner. */
export async function staffHome(staffId: number): Promise<{ businessId: number | null; isOwner: boolean }> {
  const { data, error } = await supabase.from("staff").select("business_id, is_owner").eq("id", staffId).maybeSingle();
  if (error) throw error;
  return { businessId: (data?.business_id as number | null) ?? null, isOwner: !!data?.is_owner };
}

/** Which business a login works for: their own (the owner starts at The Royal Chilli). null = not set up. */
export async function loginBusinessId(staffId: number): Promise<number | null> {
  const home = await staffHome(staffId);
  return home.isOwner ? DEFAULT_BUSINESS_ID : home.businessId;
}

/** Ids of this business's own staff (the owner isn't on any business's staff list). */
export async function staffIdsAt(businessId: number): Promise<number[]> {
  const { data, error } = await supabase.from("staff").select("id").eq("business_id", businessId);
  if (error) throw error;
  return (data ?? []).map((r) => r.id as number);
}

export type BusinessRow = { id: number; name: string; active: boolean };

/** Every business, in display order (the owner's switcher). */
export async function listBusinesses(): Promise<BusinessRow[]> {
  const { data, error } = await supabase.from("businesses").select("id, name, active").order("display_order").order("id");
  if (error) throw error;
  return (data ?? []) as BusinessRow[];
}

export async function getBusiness(id: number): Promise<BusinessRow | null> {
  const { data } = await supabase.from("businesses").select("id, name, active").eq("id", id).maybeSingle();
  return (data as BusinessRow | null) ?? null;
}

/** What the header needs: this business's name, and the owner's picker (owner only). */
export async function headerBusiness(session: { businessId: number; owner?: boolean }) {
  if (session.owner) {
    const all = await listBusinesses().catch(() => []);
    return { name: all.find((b) => b.id === session.businessId)?.name ?? "", switcher: all };
  }
  return { name: (await getBusiness(session.businessId).catch(() => null))?.name ?? "", switcher: undefined };
}

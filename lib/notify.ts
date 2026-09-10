import supabase from "./supabase";

type NotifType = "correction_submitted" | "correction_reviewed" | "missed_clockout";

/** Fire an in-app notification. Best-effort — never blocks the caller. */
export async function notify(
  staffId: number,
  type: NotifType,
  message: string,
  link?: string,
): Promise<void> {
  try {
    await supabase.from("notifications").insert({ staff_id: staffId, type, message, link: link ?? null });
  } catch (e) {
    console.error("notify failed:", e);
  }
}

/** Notify everyone who can act on manager things (manager / hr / admin). */
export async function notifyManagers(type: NotifType, message: string, link?: string): Promise<void> {
  try {
    const { data } = await supabase
      .from("staff")
      .select("id")
      .eq("active", 1)
      .in("role", ["manager", "hr", "admin"]);
    if (!data?.length) return;
    await supabase.from("notifications").insert(
      data.map((s) => ({ staff_id: s.id, type, message, link: link ?? null })),
    );
  } catch (e) {
    console.error("notifyManagers failed:", e);
  }
}

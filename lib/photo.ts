import supabase from "./supabase";

const BUCKET = "attendance-photos";

/**
 * Store a clock-in/out photo. `dataUrl` is a "data:image/jpeg;base64,…" string
 * captured from the phone's camera. Returns the object path, or null if there
 * was no photo or the upload failed (the caller then flags photo_missing — a
 * punch is never blocked by a camera problem).
 */
export async function storeClockPhoto(
  dataUrl: string | null | undefined,
  opts: { staffId: number; leg: "in" | "out"; workMonth: string },
): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
  try {
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0 || bytes.length > 400_000) return null; // sanity cap
    const path = `${opts.workMonth}/${opts.staffId}-${opts.leg}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) {
      console.error("clock photo upload failed:", error.message);
      return null;
    }
    return path;
  } catch (e) {
    console.error("clock photo upload threw:", e);
    return null;
  }
}

/** Short-lived signed URL for a manager viewing a stored photo. */
export async function signedPhotoUrl(path: string, seconds = 300): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

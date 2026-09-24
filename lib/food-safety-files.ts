import supabase from "./supabase";

const BUCKET = "food-safety-files";
const MAX_BYTES = 3_000_000; // 3MB raw — keeps the base64-inflated request body safely under Vercel's payload limit

const ALLOWED: Record<string, string> = {
  "data:image/jpeg": "jpg",
  "data:image/png": "png",
  "data:application/pdf": "pdf",
};

/**
 * Stores a training certificate. `dataUrl` is a "data:<mime>;base64,…"
 * string from a file picker — image or PDF. Returns the object path, or an
 * error string to show the user (never throws — a bad upload shouldn't
 * block saving the training record itself).
 */
export async function storeCertificateFile(
  dataUrl: string,
  opts: { staffId: number; courseId: number },
): Promise<{ path: string } | { error: string }> {
  const prefix = Object.keys(ALLOWED).find((p) => dataUrl.startsWith(p));
  if (!prefix) return { error: "Only JPG, PNG or PDF files are accepted" };

  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return { error: "File is empty" };
  if (bytes.length > MAX_BYTES) return { error: "File is too large (max 3MB)" };

  const ext = ALLOWED[prefix];
  const contentType = prefix.slice("data:".length);
  const path = `${opts.staffId}/${opts.courseId}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) return { error: "Upload failed — try again" };
  return { path };
}

/** Short-lived signed URL for viewing a stored certificate. */
export async function signedCertificateUrl(path: string, seconds = 300): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

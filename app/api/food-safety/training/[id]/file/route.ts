import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { canViewFoodSafety, canViewTeamTraining } from "@/lib/food-safety-permissions";
import { signedCertificateUrl } from "@/lib/food-safety-files";

// A short-lived signed URL for a training record's attached certificate —
// an employee can only ever reach their own; manager/admin can reach anyone's.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewFoodSafety(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { data: record } = await supabase.from("fs_training_record").select("staff_id, certificate_ref").eq("id", id).single();
  if (!record || !record.certificate_ref) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwn = record.staff_id === session.id;
  if (!isOwn && !canViewTeamTraining(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = await signedCertificateUrl(record.certificate_ref);
  if (!url) return NextResponse.json({ error: "Failed to generate link" }, { status: 500 });

  return NextResponse.json({ url });
}

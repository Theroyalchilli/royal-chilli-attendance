import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getSessionFromRequest } from "@/lib/auth";
import { notifyManagers } from "@/lib/notify";

export const dynamic = "force-dynamic";

const LEAVE_TYPES = new Set(["holiday", "sick", "unpaid", "other"]);

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("staff_id", session.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leave_type, start_date, end_date, reason } = await req.json();
  if (!leave_type || !LEAVE_TYPES.has(leave_type)) {
    return NextResponse.json({ error: "Invalid leave_type" }, { status: 400 });
  }
  if (!start_date || !end_date || start_date > end_date) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leave_requests")
    .insert({ staff_id: session.id, leave_type, start_date, end_date, reason: reason?.trim() || null, status: "pending" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Failed to submit" }, { status: 500 });

  await notifyManagers("leave_submitted", `${session.name} requested ${leave_type} leave (${start_date} to ${end_date}).`, "/admin/leave");
  return NextResponse.json({ success: true, request: data }, { status: 201 });
}

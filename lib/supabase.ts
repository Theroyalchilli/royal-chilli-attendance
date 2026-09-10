import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. This app shares royal-chilli-pos's " +
      "Supabase project and needs the service_role key to read/write staff and " +
      "attendance rows past RLS. Get it from Supabase → Project Settings → API."
  );
}

// Server-only. The service_role key bypasses RLS — never import from a client component.
export const supabase = createClient(supabaseUrl, serviceRoleKey);
export default supabase;

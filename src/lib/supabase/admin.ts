import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la service role: se salta RLS.
 * Solo para código de servidor (tokens cifrados, cron). Nunca importarlo
 * desde un componente de cliente.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  // 303 para que el navegador cambie de POST a GET al redirigir.
  return NextResponse.redirect(`${base}/login`, { status: 303 });
}

import { NextResponse, type NextRequest } from "next/server";

import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? origin;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=sin_codigo`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${base}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Solo entra el correo autorizado; cualquier otro cierra sesión y va a "acceso denegado".
  if (!isAllowedEmail(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${base}/acceso-denegado`);
  }

  return NextResponse.redirect(`${base}/`);
}

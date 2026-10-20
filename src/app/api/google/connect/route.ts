import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { isAllowedEmail } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/google/oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  // "state" protege contra peticiones falsas: se guarda en una cookie y se
  // comprueba al volver de Google.
  const state = randomBytes(24).toString("hex");
  const respuesta = NextResponse.redirect(buildAuthUrl(state, user.email));
  respuesta.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return respuesta;
}

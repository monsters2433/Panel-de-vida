import { NextResponse, type NextRequest } from "next/server";

import { isAllowedEmail } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { correoDelCalendarioPrincipal } from "@/lib/google/calendar";
import { exchangeCode, GOOGLE_SCOPES } from "@/lib/google/oauth";
import { guardarRefreshToken } from "@/lib/google/tokens";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? origin;

  const volver = (resultado: string) => {
    const res = NextResponse.redirect(`${base}/?google=${resultado}`);
    res.cookies.delete({ name: "google_oauth_state", path: "/api/google" });
    return res;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  // El usuario canceló o Google devolvió un error.
  if (searchParams.get("error")) return volver("cancelado");

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const stateGuardado = request.cookies.get("google_oauth_state")?.value;
  if (!code || !state || !stateGuardado || state !== stateGuardado) {
    return volver("error_estado");
  }

  try {
    const tokens = await exchangeCode(code);

    // Hay que haber aceptado los dos permisos de solo lectura.
    const concedidos = (tokens.scope ?? "").split(" ");
    if (!GOOGLE_SCOPES.every((s) => concedidos.includes(s))) {
      return volver("permisos_incompletos");
    }
    if (!tokens.refresh_token) return volver("sin_refresh_token");

    // La cuenta de Google conectada tiene que ser la tuya.
    const correoGoogle = await correoDelCalendarioPrincipal(tokens.access_token);
    if (!isAllowedEmail(correoGoogle)) return volver("cuenta_distinta");

    await guardarRefreshToken(user.id, encrypt(tokens.refresh_token));
    return volver("ok");
  } catch (e) {
    console.error("Error en el callback de Google:", e);
    return volver("error");
  }
}

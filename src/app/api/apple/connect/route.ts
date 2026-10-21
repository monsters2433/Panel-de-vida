import { NextResponse, type NextRequest } from "next/server";

import {
  borrarCredencialesApple,
  guardarCredencialesApple,
} from "@/lib/apple/credenciales";
import { verificarCredencialesApple } from "@/lib/apple/caldav";
import { AppleApiError, AppleCredencialesError } from "@/lib/apple/errors";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Contraseña específica de aplicación de Apple: cuatro grupos de cuatro letras.
// Se exige este formato para no aceptar nunca la contraseña real del Apple ID.
const FORMATO_PASSWORD = /^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/i;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function usuarioAutorizado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isAllowedEmail(user.email) ? user : null;
}

function mismoOrigen(request: NextRequest) {
  const origen = request.headers.get("origin");
  return !origen || origen === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const user = await usuarioAutorizado();
  if (!user) {
    return NextResponse.json({ error: "acceso_denegado" }, { status: 403 });
  }
  // Defensa extra contra peticiones desde otras webs (además de SameSite).
  if (
    !mismoOrigen(request) ||
    !request.headers.get("content-type")?.includes("application/json")
  ) {
    return NextResponse.json({ error: "peticion_no_valida" }, { status: 400 });
  }

  const cuerpo = (await request.json().catch(() => null)) as {
    usuario?: unknown;
    password?: unknown;
  } | null;
  const usuario = typeof cuerpo?.usuario === "string" ? cuerpo.usuario.trim() : "";
  const password =
    typeof cuerpo?.password === "string" ? cuerpo.password.trim() : "";

  if (!FORMATO_CORREO.test(usuario)) {
    return NextResponse.json({ error: "usuario_no_valido" }, { status: 400 });
  }
  if (!FORMATO_PASSWORD.test(password)) {
    return NextResponse.json({ error: "password_no_especifica" }, { status: 400 });
  }

  try {
    const calendarios = await verificarCredencialesApple({ usuario, password });
    await guardarCredencialesApple(user.id, { usuario, password });
    return NextResponse.json({ ok: true, calendarios });
  } catch (e) {
    if (e instanceof AppleCredencialesError) {
      return NextResponse.json({ error: "credenciales_incorrectas" }, { status: 401 });
    }
    if (e instanceof AppleApiError) {
      return NextResponse.json(
        { error: "apple_error", detalle: e.message },
        { status: 502 },
      );
    }
    console.error("Error al conectar Apple Calendar:", e);
    return NextResponse.json({ error: "error_interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await usuarioAutorizado();
  if (!user) {
    return NextResponse.json({ error: "acceso_denegado" }, { status: 403 });
  }
  if (!mismoOrigen(request)) {
    return NextResponse.json({ error: "peticion_no_valida" }, { status: 400 });
  }
  try {
    await borrarCredencialesApple(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Error al desconectar Apple Calendar:", e);
    return NextResponse.json({ error: "error_interno" }, { status: 500 });
  }
}

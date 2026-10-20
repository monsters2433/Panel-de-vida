import { NextResponse, type NextRequest } from "next/server";

import { analizarDia } from "@/lib/agenda";
import { isAllowedEmail } from "@/lib/auth";
import {
  APP_TIMEZONE,
  JORNADA_FIN_HORA,
  JORNADA_INICIO_HORA,
} from "@/lib/config";
import { listarEventos } from "@/lib/google/calendar";
import {
  GoogleApiError,
  GoogleNoConectadoError,
  GoogleReconectarError,
} from "@/lib/google/errors";
import { marcarSincronizacion } from "@/lib/google/tokens";
import { createClient } from "@/lib/supabase/server";
import { fechaEnZona, horaDelDia, rangoDelDia, sumarDias } from "@/lib/tz";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const ahora = new Date();
  const hoy = fechaEnZona(ahora, APP_TIMEZONE);
  const pedida = request.nextUrl.searchParams.get("fecha") ?? hoy;
  if (!FECHA.test(pedida)) {
    return NextResponse.json({ error: "fecha_no_valida" }, { status: 400 });
  }
  // Solo hoy y los 6 días siguientes (7 días en total).
  if (pedida < hoy || pedida > sumarDias(hoy, 6)) {
    return NextResponse.json({ error: "fuera_de_rango" }, { status: 400 });
  }

  try {
    const { inicio, fin } = rangoDelDia(pedida, APP_TIMEZONE);
    const eventos = await listarEventos(user.id, inicio, fin);
    const analisis = analizarDia(eventos, {
      diaInicio: inicio,
      diaFin: fin,
      jornadaInicio: horaDelDia(pedida, JORNADA_INICIO_HORA, APP_TIMEZONE),
      jornadaFin: horaDelDia(pedida, JORNADA_FIN_HORA, APP_TIMEZONE),
      ahora,
    });
    await marcarSincronizacion(user.id);

    return NextResponse.json({
      fecha: pedida,
      zonaHoraria: APP_TIMEZONE,
      ...analisis,
    });
  } catch (e) {
    if (e instanceof GoogleNoConectadoError) {
      return NextResponse.json({ error: "google_no_conectado" }, { status: 409 });
    }
    if (e instanceof GoogleReconectarError) {
      return NextResponse.json({ error: "google_reconectar" }, { status: 409 });
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json(
        { error: "google_error", detalle: e.message },
        { status: 502 },
      );
    }
    console.error("Error en /api/agenda:", e);
    return NextResponse.json({ error: "error_interno" }, { status: 500 });
  }
}

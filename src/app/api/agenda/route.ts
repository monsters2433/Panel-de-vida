import { NextResponse, type NextRequest } from "next/server";

import { analizarDia, type EventoCrudo } from "@/lib/agenda";
import { listarEventosApple } from "@/lib/apple/caldav";
import {
  AppleApiError,
  AppleCredencialesError,
  AppleNoConectadoError,
} from "@/lib/apple/errors";
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

type Aviso = {
  fuente: "google" | "apple";
  codigo: "reconectar" | "error";
  detalle?: string;
};

type Fuente =
  | { estado: "ok"; eventos: EventoCrudo[] }
  | { estado: "no_conectado" }
  | { estado: "fallo"; aviso: Aviso };

async function cargarGoogle(userId: string, desde: Date, hasta: Date): Promise<Fuente> {
  try {
    const eventos = await listarEventos(userId, desde, hasta);
    await marcarSincronizacion(userId);
    return { estado: "ok", eventos };
  } catch (e) {
    if (e instanceof GoogleNoConectadoError) return { estado: "no_conectado" };
    if (e instanceof GoogleReconectarError) {
      return { estado: "fallo", aviso: { fuente: "google", codigo: "reconectar" } };
    }
    if (e instanceof GoogleApiError) {
      return {
        estado: "fallo",
        aviso: { fuente: "google", codigo: "error", detalle: e.message },
      };
    }
    console.error("Error al leer Google Calendar:", e);
    return { estado: "fallo", aviso: { fuente: "google", codigo: "error" } };
  }
}

async function cargarApple(userId: string, desde: Date, hasta: Date): Promise<Fuente> {
  try {
    return { estado: "ok", eventos: await listarEventosApple(userId, desde, hasta) };
  } catch (e) {
    if (e instanceof AppleNoConectadoError) return { estado: "no_conectado" };
    if (e instanceof AppleCredencialesError) {
      return { estado: "fallo", aviso: { fuente: "apple", codigo: "reconectar" } };
    }
    if (e instanceof AppleApiError) {
      return {
        estado: "fallo",
        aviso: { fuente: "apple", codigo: "error", detalle: e.message },
      };
    }
    console.error("Error al leer Apple Calendar:", e);
    return { estado: "fallo", aviso: { fuente: "apple", codigo: "error" } };
  }
}

/** Si el mismo evento está en Google y en Apple (misma hora y título), se muestra una vez. */
function sinDuplicados(google: EventoCrudo[], apple: EventoCrudo[]) {
  const clave = (e: EventoCrudo) =>
    `${e.titulo.trim().toLowerCase()}|${e.inicio}|${e.fin}`;
  const vistas = new Set(google.map(clave));
  return [...google, ...apple.filter((e) => !vistas.has(clave(e)))];
}

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
    const [google, apple] = await Promise.all([
      cargarGoogle(user.id, inicio, fin),
      cargarApple(user.id, inicio, fin),
    ]);

    const fuentes = [google, apple];
    const avisos = fuentes.flatMap((f) => (f.estado === "fallo" ? [f.aviso] : []));

    // Ninguna fuente respondió: se explica por qué.
    if (!fuentes.some((f) => f.estado === "ok")) {
      if (avisos.length === 0) {
        return NextResponse.json({ error: "sin_calendarios" }, { status: 409 });
      }
      const primero = avisos[0];
      return NextResponse.json(
        {
          error:
            primero.codigo === "reconectar"
              ? `${primero.fuente}_reconectar`
              : `${primero.fuente}_error`,
          detalle: primero.detalle,
          avisos,
        },
        { status: primero.codigo === "reconectar" ? 409 : 502 },
      );
    }

    const eventos = sinDuplicados(
      google.estado === "ok" ? google.eventos : [],
      apple.estado === "ok" ? apple.eventos : [],
    );
    const analisis = analizarDia(eventos, {
      diaInicio: inicio,
      diaFin: fin,
      jornadaInicio: horaDelDia(pedida, JORNADA_INICIO_HORA, APP_TIMEZONE),
      jornadaFin: horaDelDia(pedida, JORNADA_FIN_HORA, APP_TIMEZONE),
      ahora,
    });

    return NextResponse.json({
      fecha: pedida,
      zonaHoraria: APP_TIMEZONE,
      avisos,
      ...analisis,
    });
  } catch (e) {
    console.error("Error en /api/agenda:", e);
    return NextResponse.json({ error: "error_interno" }, { status: 500 });
  }
}

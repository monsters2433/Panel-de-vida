import "server-only";

import type { EventoCrudo } from "@/lib/agenda";

import { GoogleApiError } from "./errors";
import { getAccessToken } from "./tokens";

type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  transparency?: string;
  eventType?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
};

const API = "https://www.googleapis.com/calendar/v3";

const REGEX_VIDEO =
  /https?:\/\/[^\s"'<>]*(?:zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.google\.com|whereby\.com|webex\.com)[^\s"'<>]*/i;

async function llamar<T>(accessToken: string, ruta: string): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new GoogleApiError(
      res.status,
      cuerpo.error?.message ?? `Google Calendar respondió ${res.status}`,
    );
  }
  return (await res.json()) as T;
}

function buscarEnlaceVideo(e: GoogleEvent): string | null {
  if (e.hangoutLink) return e.hangoutLink;
  const entrada = e.conferenceData?.entryPoints?.find(
    (p) => p.entryPointType === "video" && p.uri,
  );
  if (entrada?.uri) return entrada.uri;
  const texto = `${e.location ?? ""} ${e.description ?? ""}`;
  const coincidencia = texto.match(REGEX_VIDEO);
  return coincidencia ? coincidencia[0].replace(/[).,;]+$/, "") : null;
}

function convertir(e: GoogleEvent): EventoCrudo | null {
  if (e.status === "cancelled") return null;
  if (e.eventType === "workingLocation") return null;
  // Eventos que rechacé: no cuentan.
  if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) {
    return null;
  }

  const todoElDia = Boolean(e.start?.date && !e.start?.dateTime);
  const inicio = e.start?.dateTime ?? e.start?.date;
  const fin = e.end?.dateTime ?? e.end?.date;
  if (!inicio || !fin) return null;

  return {
    id: e.id,
    titulo: e.summary?.trim() || "(Sin título)",
    descripcion: e.description ?? null,
    inicio,
    fin,
    todoElDia,
    enlaceVideo: buscarEnlaceVideo(e),
    enlace: e.htmlLink ?? null,
    ocupado: !todoElDia && e.transparency !== "transparent",
  };
}

/** Eventos del calendario principal entre dos instantes. Solo lectura. */
export async function listarEventos(
  userId: string,
  desde: Date,
  hasta: Date,
): Promise<EventoCrudo[]> {
  const token = await getAccessToken(userId);
  const params = new URLSearchParams({
    timeMin: desde.toISOString(),
    timeMax: hasta.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    fields:
      "items(id,status,summary,description,location,htmlLink,hangoutLink,conferenceData/entryPoints,start,end,transparency,eventType,attendees(self,responseStatus))",
  });
  const data = await llamar<{ items?: GoogleEvent[] }>(
    token,
    `/calendars/primary/events?${params.toString()}`,
  );
  return (data.items ?? []).map(convertir).filter((e): e is EventoCrudo => e !== null);
}

/** Correo al que pertenece el calendario principal (sirve para comprobar la cuenta conectada). */
export async function correoDelCalendarioPrincipal(
  accessToken: string,
): Promise<string> {
  const cal = await llamar<{ id: string }>(accessToken, "/calendars/primary");
  return cal.id;
}

import "server-only";

import { createDAVClient } from "tsdav";

import type { EventoCrudo } from "@/lib/agenda";
import { APP_TIMEZONE } from "@/lib/config";

import {
  leerCredencialesApple,
  marcarSincronizacionApple,
  type CredencialesApple,
} from "./credenciales";
import { AppleApiError, AppleCredencialesError } from "./errors";
import { expandirICS } from "./ics";

const SERVIDOR = "https://caldav.icloud.com";
const TIMEOUT_MS = 15_000;

async function crearCliente(cred: CredencialesApple) {
  return createDAVClient({
    serverUrl: SERVIDOR,
    credentials: { username: cred.usuario, password: cred.password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
    fetchOptions: { signal: AbortSignal.timeout(TIMEOUT_MS) },
  });
}

function traducir(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid credentials|\b401\b|unauthori[sz]ed|forbidden|\b403\b/i.test(msg)) {
    return new AppleCredencialesError();
  }
  if (/timeout|aborted/i.test(msg)) {
    return new AppleApiError("iCloud tardó demasiado en responder");
  }
  return new AppleApiError(msg);
}

function calendariosDeEventos<T extends { components?: string[] }>(cals: T[]) {
  return cals.filter((c) => !c.components || c.components.includes("VEVENT"));
}

/** Comprueba usuario y contraseña contra iCloud. Devuelve cuántos calendarios hay. */
export async function verificarCredencialesApple(
  cred: CredencialesApple,
): Promise<number> {
  try {
    const cliente = await crearCliente(cred);
    const calendarios = calendariosDeEventos(await cliente.fetchCalendars());
    if (calendarios.length === 0) {
      throw new AppleApiError("La cuenta no tiene ningún calendario de eventos");
    }
    return calendarios.length;
  } catch (e) {
    throw e instanceof AppleApiError || e instanceof AppleCredencialesError
      ? e
      : traducir(e);
  }
}

/** Eventos de todos los calendarios de iCloud entre dos instantes. Solo lectura. */
export async function listarEventosApple(
  userId: string,
  desde: Date,
  hasta: Date,
): Promise<EventoCrudo[]> {
  const cred = await leerCredencialesApple(userId);

  try {
    const cliente = await crearCliente(cred);
    const calendarios = calendariosDeEventos(await cliente.fetchCalendars());

    const porCalendario = await Promise.all(
      calendarios.map((calendario) =>
        cliente.fetchCalendarObjects({
          calendar: calendario,
          timeRange: { start: desde.toISOString(), end: hasta.toISOString() },
        }),
      ),
    );

    const eventos: EventoCrudo[] = [];
    for (const objeto of porCalendario.flat()) {
      if (typeof objeto.data !== "string" || !objeto.data) continue;
      try {
        eventos.push(
          ...expandirICS(objeto.data, {
            desde,
            hasta,
            zonaFlotante: APP_TIMEZONE,
            misCorreos: [cred.usuario.toLowerCase()],
          }),
        );
      } catch (e) {
        // Un evento ilegible no debe tumbar toda la agenda.
        console.error("Evento de iCloud ilegible:", e);
      }
    }

    await marcarSincronizacionApple(userId);
    return eventos;
  } catch (e) {
    throw traducir(e);
  }
}

// Lectura de iCalendar (.ics) y expansión de eventos recurrentes.
// Sin red ni base de datos: es lógica pura y se puede probar.

import ICAL from "ical.js";

import type { EventoCrudo } from "@/lib/agenda";
import { zonedTimeToUtc } from "@/lib/tz";

const REGEX_VIDEO =
  /https?:\/\/[^\s"'<>]*(?:zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.google\.com|whereby\.com|webex\.com|facetime\.apple\.com)[^\s"'<>]*/i;

// Topes de seguridad para series muy largas (p. ej. un evento diario sin fin
// que empezó hace años). 15000 repeticiones diarias son unos 41 años.
const MAX_ITERACIONES = 15_000;
const MAX_MS_POR_SERIE = 3_000;

type Opciones = {
  desde: Date;
  hasta: Date;
  /** Zona para eventos "flotantes" (sin zona horaria en el .ics). */
  zonaFlotante: string;
  /** Correos propios (en minúsculas), para ignorar eventos que rechacé. */
  misCorreos?: string[];
};

function aInstante(t: ICAL.Time, zonaFlotante: string): Date {
  if (t.zone && t.zone.tzid === "floating") {
    return zonedTimeToUtc(t.year, t.month, t.day, t.hour, t.minute, zonaFlotante);
  }
  return t.toJSDate();
}

function inicioDeDia(t: ICAL.Time, zonaFlotante: string): Date {
  return zonedTimeToUtc(t.year, t.month, t.day, 0, 0, zonaFlotante);
}

function dosDigitos(n: number) {
  return String(n).padStart(2, "0");
}

function fechaIso(t: ICAL.Time) {
  return `${t.year}-${dosDigitos(t.month)}-${dosDigitos(t.day)}`;
}

function textoProp(comp: ICAL.Component, nombre: string): string | null {
  const v = comp.getFirstPropertyValue(nombre);
  return typeof v === "string" && v.trim() ? v : null;
}

function rechazado(comp: ICAL.Component, misCorreos: string[]): boolean {
  if (misCorreos.length === 0) return false;
  return comp.getAllProperties("attendee").some((p) => {
    const correo = String(p.getFirstValue() ?? "")
      .replace(/^mailto:/i, "")
      .toLowerCase();
    return (
      misCorreos.includes(correo) &&
      String(p.getParameter("partstat") ?? "").toUpperCase() === "DECLINED"
    );
  });
}

function construir(
  uid: string,
  comp: ICAL.Component,
  inicio: ICAL.Time,
  fin: ICAL.Time,
  o: Opciones,
): EventoCrudo | null {
  const estado = String(comp.getFirstPropertyValue("status") ?? "").toUpperCase();
  if (estado === "CANCELLED") return null;
  if (rechazado(comp, o.misCorreos ?? [])) return null;

  const todoElDia = inicio.isDate;
  let ini: Date;
  let fn: Date;
  if (todoElDia) {
    ini = inicioDeDia(inicio, o.zonaFlotante);
    fn = fin.isDate ? inicioDeDia(fin, o.zonaFlotante) : aInstante(fin, o.zonaFlotante);
  } else {
    ini = aInstante(inicio, o.zonaFlotante);
    fn = aInstante(fin, o.zonaFlotante);
  }
  // Fuera del rango pedido.
  if (!(fn > o.desde && ini < o.hasta) && !(ini >= o.desde && ini < o.hasta)) {
    return null;
  }

  const descripcion = textoProp(comp, "description");
  const lugar = textoProp(comp, "location");
  const url = textoProp(comp, "url");
  const coincidencia = `${lugar ?? ""} ${url ?? ""} ${descripcion ?? ""}`.match(
    REGEX_VIDEO,
  );
  const transparente =
    String(comp.getFirstPropertyValue("transp") ?? "").toUpperCase() ===
    "TRANSPARENT";

  return {
    id: `apple:${uid}:${ini.toISOString()}`,
    titulo: textoProp(comp, "summary")?.trim() || "(Sin título)",
    descripcion,
    inicio: todoElDia ? fechaIso(inicio) : ini.toISOString(),
    fin: todoElDia ? fechaIso(fin) : fn.toISOString(),
    todoElDia,
    enlaceVideo: coincidencia ? coincidencia[0].replace(/[).,;]+$/, "") : null,
    enlace: null,
    ocupado: !todoElDia && !transparente,
  };
}

const DIA_MS = 86_400_000;

/**
 * Las series diarias/semanales sin fin que empezaron hace años obligarían a
 * recorrer miles de repeticiones. Como ical.js no permite saltar sin alterar
 * las horas, se adelanta el inicio de la serie un número exacto de periodos
 * (así los días de la semana y la hora local siguen alineados) hasta unas dos
 * semanas antes del rango. Solo se hace si no hay COUNT, que dependería del inicio.
 */
function adelantarSerie(maestro: ICAL.Component, o: Opciones): ICAL.Component {
  const reglas = maestro.getAllProperties("rrule");
  if (reglas.length !== 1) return maestro;
  const regla = reglas[0].getFirstValue() as ICAL.Recur;
  if (regla.count || (regla.freq !== "DAILY" && regla.freq !== "WEEKLY")) {
    return maestro;
  }

  const inicioProp = maestro.getFirstProperty("dtstart");
  const inicio = inicioProp?.getFirstValue() as ICAL.Time | undefined;
  if (!inicioProp || !inicio) return maestro;

  const inicioMs = (
    inicio.isDate
      ? inicioDeDia(inicio, o.zonaFlotante)
      : aInstante(inicio, o.zonaFlotante)
  ).getTime();
  const periodoDias = (regla.interval || 1) * (regla.freq === "WEEKLY" ? 7 : 1);
  const diasHastaRango = Math.floor((o.desde.getTime() - inicioMs) / DIA_MS) - 14;
  const saltos = Math.floor(diasHastaRango / periodoDias);
  if (saltos <= 0) return maestro;

  const desplazamiento = saltos * periodoDias;
  const copia = new ICAL.Component(maestro.toJSON());
  for (const nombre of ["dtstart", "dtend"]) {
    const prop = copia.getFirstProperty(nombre);
    const valor = prop?.getFirstValue() as ICAL.Time | undefined;
    if (!prop || !valor) continue;
    const nuevo = valor.clone();
    nuevo.adjust(desplazamiento, 0, 0, 0);
    prop.setValue(nuevo);
  }
  return copia;
}

/** Convierte el texto de un .ics en los eventos que caen dentro del rango. */
export function expandirICS(texto: string, o: Opciones): EventoCrudo[] {
  const calendario = new ICAL.Component(ICAL.parse(texto));

  // Zonas horarias definidas dentro del propio archivo.
  for (const vtz of calendario.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(new ICAL.Timezone(vtz));
    } catch {
      // Zona mal formada: se ignora y se usa la que ical.js ya conozca.
    }
  }

  const porUid = new Map<
    string,
    { maestro?: ICAL.Component; excepciones: ICAL.Component[] }
  >();
  for (const ve of calendario.getAllSubcomponents("vevent")) {
    const uid = textoProp(ve, "uid");
    if (!uid) continue;
    const grupo = porUid.get(uid) ?? { excepciones: [] };
    if (ve.hasProperty("recurrence-id")) grupo.excepciones.push(ve);
    else grupo.maestro = ve;
    porUid.set(uid, grupo);
  }

  const resultado: EventoCrudo[] = [];

  for (const [uid, grupo] of porUid) {
    // Una excepción suelta (sin evento maestro en este archivo) se trata como evento normal.
    const bases = grupo.maestro ? [grupo.maestro] : grupo.excepciones;

    for (const base of bases) {
      const ev = new ICAL.Event(grupo.maestro ? adelantarSerie(base, o) : base);
      if (grupo.maestro) {
        for (const ex of grupo.excepciones) ev.relateException(ex);
      }

      if (!ev.isRecurring()) {
        const e = construir(uid, base, ev.startDate, ev.endDate, o);
        if (e) resultado.push(e);
        continue;
      }

      // Se recorre la serie desde su primer día (ical.js no permite saltar sin
      // alterar las horas). Hay un tope de repeticiones y de tiempo por serie.
      const it = ev.iterator();
      const limiteTiempo = Date.now() + MAX_MS_POR_SERIE;
      for (let n = 0; n < MAX_ITERACIONES; n++) {
        if (n % 200 === 0 && Date.now() > limiteTiempo) {
          console.error(`Serie de iCloud demasiado larga, recortada: ${uid}`);
          break;
        }
        const siguiente = it.next();
        if (!siguiente) break;
        const det = ev.getOccurrenceDetails(siguiente);
        const comienzo = det.startDate.isDate
          ? inicioDeDia(det.startDate, o.zonaFlotante)
          : aInstante(det.startDate, o.zonaFlotante);
        if (comienzo >= o.hasta) break;
        const e = construir(uid, det.item.component, det.startDate, det.endDate, o);
        if (e) resultado.push(e);
      }
    }
  }

  return resultado;
}

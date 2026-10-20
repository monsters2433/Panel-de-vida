// Utilidades de zona horaria sin dependencias (usa Intl).

/** Diferencia en ms entre la hora local de `tz` y UTC en el instante `utc`. */
function offsetMs(utc: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(utc)) p[part.type] = part.value;
  const comoUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return comoUtc - Math.floor(utc.getTime() / 1000) * 1000;
}

/** Convierte una hora local de `tz` (año, mes 1-12, día, hora, minuto) a un instante UTC. */
export function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  tz: string,
): Date {
  const aprox = Date.UTC(y, m - 1, d, h, min);
  const off1 = offsetMs(new Date(aprox), tz);
  let t = aprox - off1;
  const off2 = offsetMs(new Date(t), tz);
  if (off2 !== off1) t = aprox - off2; // cambio de hora (DST) cerca de ese instante
  return new Date(t);
}

/** Fecha local (YYYY-MM-DD) de un instante en la zona `tz`. */
export function fechaEnZona(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Instante UTC de una hora concreta de una fecha local. */
export function horaDelDia(fecha: string, hora: number, tz: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return zonedTimeToUtc(y, m, d, hora, 0, tz);
}

/** Inicio (incluido) y fin (excluido) del día local, como instantes UTC. */
export function rangoDelDia(fecha: string, tz: string) {
  return {
    inicio: horaDelDia(fecha, 0, tz),
    fin: horaDelDia(sumarDias(fecha, 1), 0, tz),
  };
}

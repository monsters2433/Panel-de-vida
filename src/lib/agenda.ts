// Lógica pura de la agenda (sin red ni base de datos), fácil de probar.

const MIN = 60_000;
export const MIN_SEPARACION_MS = 15 * MIN;
export const MIN_LIBRE_MS = 45 * MIN;

export type EventoCrudo = {
  id: string;
  titulo: string;
  descripcion: string | null;
  /** ISO con hora, o YYYY-MM-DD si es de todo el día. */
  inicio: string;
  fin: string;
  todoElDia: boolean;
  enlaceVideo: string | null;
  enlace: string | null;
  /** false si el evento está marcado como "disponible" (no bloquea el calendario). */
  ocupado: boolean;
};

export type EventoAgenda = {
  id: string;
  titulo: string;
  inicio: string;
  fin: string;
  todoElDia: boolean;
  duracionMin: number | null;
  enlaceVideo: string | null;
  enlace: string | null;
  tieneDescripcion: boolean;
  conflicto: boolean;
  pocaSeparacion: boolean;
};

export type BloqueLibre = { inicio: string; fin: string; minutos: number };

export type AnalisisDia = {
  eventos: EventoAgenda[];
  libres: BloqueLibre[];
  resumen: { reuniones: number; minutosOcupados: number };
};

type Opciones = {
  diaInicio: Date;
  diaFin: Date;
  jornadaInicio: Date;
  jornadaFin: Date;
  ahora: Date;
};

type ConHora = EventoCrudo & { ini: number; fn: number };

export function analizarDia(crudos: EventoCrudo[], o: Opciones): AnalisisDia {
  const conHora: ConHora[] = crudos
    .filter((e) => !e.todoElDia)
    .map((e) => ({ ...e, ini: Date.parse(e.inicio), fn: Date.parse(e.fin) }))
    .filter((e) => Number.isFinite(e.ini) && Number.isFinite(e.fn))
    .sort((a, b) => a.ini - b.ini || a.fn - b.fn);

  const marcas = new Map<ConHora, { conflicto: boolean; pocaSeparacion: boolean }>();
  const marca = (e: ConHora) => {
    let m = marcas.get(e);
    if (!m) {
      m = { conflicto: false, pocaSeparacion: false };
      marcas.set(e, m);
    }
    return m;
  };

  // Conflictos (solapes) y huecos de menos de 15 minutos entre eventos ocupados.
  const ocupados = conHora.filter((e) => e.ocupado);
  let maxFin = -Infinity;
  let evMaxFin: ConHora | null = null;
  for (const e of ocupados) {
    if (evMaxFin) {
      if (e.ini < maxFin) {
        marca(e).conflicto = true;
        marca(evMaxFin).conflicto = true;
      } else if (e.ini - maxFin < MIN_SEPARACION_MS) {
        marca(e).pocaSeparacion = true;
        marca(evMaxFin).pocaSeparacion = true;
      }
    }
    if (e.fn > maxFin) {
      maxFin = e.fn;
      evMaxFin = e;
    }
  }

  // Huecos libres de más de 45 minutos dentro de la jornada.
  const hoyEnCurso = o.ahora >= o.diaInicio && o.ahora < o.diaFin;
  const desde = Math.max(
    o.jornadaInicio.getTime(),
    hoyEnCurso ? o.ahora.getTime() : -Infinity,
  );
  const hasta = o.jornadaFin.getTime();

  const fusionar = (limiteIni: number, limiteFin: number) => {
    const tramos = ocupados
      .map((e) => ({ ini: Math.max(e.ini, limiteIni), fn: Math.min(e.fn, limiteFin) }))
      .filter((t) => t.fn > t.ini)
      .sort((a, b) => a.ini - b.ini);
    const fusion: { ini: number; fn: number }[] = [];
    for (const t of tramos) {
      const ultimo = fusion[fusion.length - 1];
      if (ultimo && t.ini <= ultimo.fn) ultimo.fn = Math.max(ultimo.fn, t.fn);
      else fusion.push({ ...t });
    }
    return fusion;
  };

  const libres: BloqueLibre[] = [];
  if (hasta > desde) {
    let cursor = desde;
    const empujar = (ini: number, fn: number) => {
      if (fn - ini > MIN_LIBRE_MS) {
        libres.push({
          inicio: new Date(ini).toISOString(),
          fin: new Date(fn).toISOString(),
          minutos: Math.round((fn - ini) / MIN),
        });
      }
    };
    for (const t of fusionar(desde, hasta)) {
      empujar(cursor, t.ini);
      cursor = Math.max(cursor, t.fn);
    }
    empujar(cursor, hasta);
  }

  const minutosOcupados = Math.round(
    fusionar(o.diaInicio.getTime(), o.diaFin.getTime()).reduce(
      (suma, t) => suma + (t.fn - t.ini),
      0,
    ) / MIN,
  );

  const deTodoElDia: EventoAgenda[] = crudos
    .filter((e) => e.todoElDia)
    .map((e) => ({
      id: e.id,
      titulo: e.titulo,
      inicio: e.inicio,
      fin: e.fin,
      todoElDia: true,
      duracionMin: null,
      enlaceVideo: e.enlaceVideo,
      enlace: e.enlace,
      tieneDescripcion: Boolean(e.descripcion?.trim()),
      conflicto: false,
      pocaSeparacion: false,
    }));

  const eventos: EventoAgenda[] = [
    ...deTodoElDia,
    ...conHora.map((e) => ({
      id: e.id,
      titulo: e.titulo,
      inicio: new Date(e.ini).toISOString(),
      fin: new Date(e.fn).toISOString(),
      todoElDia: false,
      duracionMin: Math.round((e.fn - e.ini) / MIN),
      enlaceVideo: e.enlaceVideo,
      enlace: e.enlace,
      tieneDescripcion: Boolean(e.descripcion?.trim()),
      conflicto: marcas.get(e)?.conflicto ?? false,
      pocaSeparacion: marcas.get(e)?.pocaSeparacion ?? false,
    })),
  ];

  return {
    eventos,
    libres,
    resumen: { reuniones: ocupados.length, minutosOcupados },
  };
}

"use client";

import { useEffect, useState } from "react";
import { Clock, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalisisDia, BloqueLibre, EventoAgenda } from "@/lib/agenda";
import { cn } from "@/lib/utils";

type Datos = AnalisisDia & { fecha: string; zonaHoraria: string };
type Estado =
  | { tipo: "ok"; datos: Datos }
  | { tipo: "error"; codigo: string; detalle?: string };

function hora(iso: string, tz: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function duracion(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function etiquetaDia(fecha: string, i: number) {
  if (i === 0) return "Hoy";
  if (i === 1) return "Mañana";
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T12:00:00Z`));
}

type Linea =
  | { tipo: "evento"; inicio: string; evento: EventoAgenda }
  | { tipo: "libre"; inicio: string; bloque: BloqueLibre };

function BotonGoogle({ texto }: { texto: string }) {
  // Enlace normal (no <Link>) para que Next no pre-cargue la ruta de OAuth.
  return (
    <Button asChild size="sm" variant="outline">
      <a href="/api/google/connect">{texto}</a>
    </Button>
  );
}

function MensajeError({ codigo, detalle }: { codigo: string; detalle?: string }) {
  if (codigo === "google_no_conectado") {
    return (
      <div className="flex flex-col items-start gap-3 text-sm">
        <p className="text-muted-foreground">
          Conecta tu cuenta de Google para ver aquí tu calendario.
        </p>
        <BotonGoogle texto="Conectar Google" />
      </div>
    );
  }
  if (codigo === "google_reconectar") {
    return (
      <div className="flex flex-col items-start gap-3 text-sm">
        <p className="text-muted-foreground">
          La conexión con Google caducó o fue revocada. Vuelve a conectarla.
        </p>
        <BotonGoogle texto="Reconectar Google" />
      </div>
    );
  }
  if (codigo === "google_error") {
    return (
      <p className="text-sm text-muted-foreground">
        Google devolvió un error: {detalle ?? "sin detalle"}
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      No se pudo cargar la agenda ({codigo}). Revisa las variables de entorno y
      los registros de Vercel.
    </p>
  );
}

export function AgendaClient({
  dias,
  zonaHoraria,
}: {
  dias: string[];
  zonaHoraria: string;
}) {
  const [fecha, setFecha] = useState(dias[0]);
  const [resultado, setResultado] = useState<{
    fecha: string;
    estado: Estado;
  } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/agenda?fecha=${fecha}`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setResultado({
            fecha,
            estado: {
              tipo: "error",
              codigo: json.error ?? `http_${res.status}`,
              detalle: json.detalle,
            },
          });
        } else {
          setResultado({ fecha, estado: { tipo: "ok", datos: json as Datos } });
        }
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setResultado({ fecha, estado: { tipo: "error", codigo: "sin_conexion" } });
      });
    return () => ctrl.abort();
  }, [fecha]);

  // Mientras no haya respuesta para el día elegido, se muestra "Cargando".
  const estado = resultado && resultado.fecha === fecha ? resultado.estado : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda</CardTitle>
        <CardDescription>Tu calendario de Google, solo lectura.</CardDescription>
        <div
          role="tablist"
          aria-label="Elegir día"
          className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {dias.map((d, i) => (
            <Button
              key={d}
              role="tab"
              aria-selected={d === fecha}
              size="sm"
              variant={d === fecha ? "default" : "outline"}
              className="shrink-0 capitalize"
              onClick={() => setFecha(d)}
            >
              {etiquetaDia(d, i)}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {!estado && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {estado?.tipo === "error" && (
          <MensajeError codigo={estado.codigo} detalle={estado.detalle} />
        )}
        {estado?.tipo === "ok" && (
          <DiaAgenda datos={estado.datos} tz={zonaHoraria} />
        )}
      </CardContent>
    </Card>
  );
}

function DiaAgenda({ datos, tz }: { datos: Datos; tz: string }) {
  const todoElDia = datos.eventos.filter((e) => e.todoElDia);
  const lineas: Linea[] = [
    ...datos.eventos
      .filter((e) => !e.todoElDia)
      .map((evento): Linea => ({ tipo: "evento", inicio: evento.inicio, evento })),
    ...datos.libres.map(
      (bloque): Linea => ({ tipo: "libre", inicio: bloque.inicio, bloque }),
    ),
  ].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));

  const { reuniones, minutosOcupados } = datos.resumen;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {reuniones === 0
          ? "Sin reuniones este día."
          : `${reuniones} ${reuniones === 1 ? "reunión" : "reuniones"} · ${duracion(minutosOcupados)} ocupadas`}
      </p>

      {todoElDia.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {todoElDia.map((e) => (
            <li key={e.id}>
              <Badge variant="secondary">Todo el día · {e.titulo}</Badge>
            </li>
          ))}
        </ul>
      )}

      {lineas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay eventos con hora.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {lineas.map((l) =>
            l.tipo === "evento" ? (
              <FilaEvento key={l.evento.id} e={l.evento} tz={tz} />
            ) : (
              <FilaLibre key={`libre-${l.inicio}`} b={l.bloque} tz={tz} />
            ),
          )}
        </ol>
      )}
    </div>
  );
}

function FilaEvento({ e, tz }: { e: EventoAgenda; tz: string }) {
  return (
    <li
      className={cn(
        "flex gap-3 rounded-lg border p-3",
        e.conflicto && "border-foreground",
      )}
    >
      <div className="w-24 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {hora(e.inicio, tz)}–{hora(e.fin, tz)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">
          {e.enlace ? (
            <a
              href={e.enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {e.titulo}
            </a>
          ) : (
            e.titulo
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {e.duracionMin !== null && <span>{duracion(e.duracionMin)}</span>}
          {e.enlaceVideo && (
            <a
              href={e.enlaceVideo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              <Video className="size-3.5" />
              Videollamada
            </a>
          )}
          {e.conflicto && <Badge>Conflicto de horario</Badge>}
          {e.pocaSeparacion && (
            <Badge variant="outline">Menos de 15 min de separación</Badge>
          )}
        </div>
      </div>
    </li>
  );
}

function FilaLibre({ b, tz }: { b: BloqueLibre; tz: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-muted-foreground">
      <div className="w-24 shrink-0 font-mono text-xs tabular-nums">
        {hora(b.inicio, tz)}–{hora(b.fin, tz)}
      </div>
      <p className="flex items-center gap-1.5 text-sm">
        <Clock className="size-3.5" />
        Tiempo disponible · {duracion(b.minutos)}
      </p>
    </li>
  );
}

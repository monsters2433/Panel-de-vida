import { connection } from "next/server";

import { APP_TIMEZONE } from "@/lib/config";
import { fechaEnZona, sumarDias } from "@/lib/tz";

import { AgendaClient } from "./agenda-client";

/** Calcula los 7 días del selector en el servidor (hora de Madrid) y pinta la agenda. */
export async function AgendaSection() {
  await connection();
  const hoy = fechaEnZona(new Date(), APP_TIMEZONE);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i));

  return <AgendaClient dias={dias} zonaHoraria={APP_TIMEZONE} />;
}

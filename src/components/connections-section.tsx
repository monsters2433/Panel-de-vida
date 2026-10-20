import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_TIMEZONE } from "@/lib/config";
import { obtenerEstadoIntegracion } from "@/lib/google/tokens";
import { createClient } from "@/lib/supabase/server";

function formatearFecha(iso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: APP_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export async function ConnectionsSection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let estado: Awaited<ReturnType<typeof obtenerEstadoIntegracion>> | null = null;
  try {
    estado = await obtenerEstadoIntegracion(user.id);
  } catch (e) {
    console.error("No se pudo leer el estado de las conexiones:", e);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexiones</CardTitle>
        <CardDescription>Servicios conectados y su última sincronización.</CardDescription>
      </CardHeader>
      <CardContent>
        {estado === null ? (
          <p className="text-sm text-muted-foreground">
            No se pudo leer el estado de las conexiones. Comprueba que
            SUPABASE_SERVICE_ROLE_KEY está definida en Vercel.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Google (Calendar y Gmail)</p>
                <Badge variant={estado.conectado ? "default" : "outline"}>
                  {estado.conectado
                    ? "Conectado"
                    : estado.existe
                      ? "Reconexión necesaria"
                      : "Sin conectar"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {estado.ultimaSincronizacion
                  ? `Última sincronización: ${formatearFecha(estado.ultimaSincronizacion)}`
                  : "Sin sincronizar todavía"}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href="/api/google/connect">
                {estado.conectado ? "Reconectar" : "Conectar"}
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

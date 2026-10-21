import { AppleConnection } from "@/components/apple-connection";
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

type Estado = Awaited<ReturnType<typeof obtenerEstadoIntegracion>>;

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

  let google: Estado | null = null;
  let apple: Estado | null = null;
  try {
    [google, apple] = await Promise.all([
      obtenerEstadoIntegracion(user.id, "google"),
      obtenerEstadoIntegracion(user.id, "apple"),
    ]);
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
        {google === null || apple === null ? (
          <p className="text-sm text-muted-foreground">
            No se pudo leer el estado de las conexiones. Comprueba que
            SUPABASE_SERVICE_ROLE_KEY está definida en Vercel.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Google (Calendar y Gmail)</p>
                  <Badge variant={google.conectado ? "default" : "outline"}>
                    {google.conectado
                      ? "Conectado"
                      : google.existe
                        ? "Reconexión necesaria"
                        : "Sin conectar"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {google.ultimaSincronizacion
                    ? `Última sincronización: ${formatearFecha(google.ultimaSincronizacion)}`
                    : "Sin sincronizar todavía"}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href="/api/google/connect">
                  {google.conectado ? "Reconectar" : "Conectar"}
                </a>
              </Button>
            </div>

            <div className="border-t pt-6">
              <AppleConnection
                conectado={apple.conectado}
                existe={apple.existe}
                ultimaSincronizacion={
                  apple.ultimaSincronizacion
                    ? formatearFecha(apple.ultimaSincronizacion)
                    : null
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

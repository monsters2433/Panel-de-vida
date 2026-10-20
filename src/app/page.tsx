import { Suspense } from "react";

import { AgendaSection } from "@/components/agenda-section";
import { AvisoGoogle } from "@/components/aviso-google";
import { ConnectionsSection } from "@/components/connections-section";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

async function CorreoUsuario() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
  );
}

function Cargando({ titulo }: { titulo: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </CardHeader>
    </Card>
  );
}

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Panel de Vida</h1>
          <Suspense
            fallback={<p className="h-5 text-sm text-muted-foreground">…</p>}
          >
            <CorreoUsuario />
          </Suspense>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <Suspense fallback={null}>
        <AvisoGoogle searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<Cargando titulo="Agenda" />}>
        <AgendaSection />
      </Suspense>

      <Suspense fallback={<Cargando titulo="Conexiones" />}>
        <ConnectionsSection />
      </Suspense>
    </div>
  );
}

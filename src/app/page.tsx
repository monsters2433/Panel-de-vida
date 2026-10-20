import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
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

export default function HomePage() {
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

      <Card>
        <CardHeader>
          <CardTitle>Fase (a) lista</CardTitle>
          <CardDescription>
            El login con Google y la protección de acceso funcionan. En las
            siguientes fases irán apareciendo aquí la agenda, los correos, las
            tareas y las alertas.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Si ves esta pantalla con tu correo arriba, el inicio de sesión está
          funcionando.
        </CardContent>
      </Card>
    </div>
  );
}

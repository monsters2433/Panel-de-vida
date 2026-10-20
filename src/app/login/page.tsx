import { Suspense } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginButton } from "./login-button";

const MENSAJES_ERROR: Record<string, string> = {
  sin_codigo: "No se recibió el código de Google. Inténtalo de nuevo.",
  auth: "No se pudo completar el inicio de sesión. Inténtalo de nuevo.",
};

async function MensajeError({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { error } = await searchParams;
  const mensaje = typeof error === "string" ? MENSAJES_ERROR[error] : undefined;
  if (!mensaje) return null;

  return (
    <p role="alert" className="rounded-md border p-3 text-sm">
      {mensaje}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Panel de Vida</CardTitle>
          <CardDescription>
            Tu calendario, correo y tareas en una sola página.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Suspense fallback={null}>
            <MensajeError searchParams={searchParams} />
          </Suspense>
          <LoginButton />
          <p className="text-center text-xs text-muted-foreground">
            Acceso privado: solo funciona con la cuenta autorizada.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

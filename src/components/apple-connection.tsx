"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ERRORES: Record<string, string> = {
  usuario_no_valido: "Escribe tu Apple ID completo (un correo).",
  password_no_especifica:
    "Esa no parece una contraseña específica de aplicación. Tiene el formato xxxx-xxxx-xxxx-xxxx. No uses la contraseña de tu Apple ID.",
  credenciales_incorrectas:
    "iCloud rechazó el Apple ID o la contraseña. Revisa que la contraseña específica esté bien copiada y no haya sido revocada.",
  apple_error: "iCloud no respondió correctamente. Inténtalo de nuevo en un momento.",
  acceso_denegado: "Tu sesión no tiene permiso para hacer esto.",
  peticion_no_valida: "La petición no es válida. Recarga la página e inténtalo de nuevo.",
};

type Props = {
  conectado: boolean;
  existe: boolean;
  ultimaSincronizacion: string | null;
};

export function AppleConnection({ conectado, existe, ultimaSincronizacion }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function conectar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/apple/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        detalle?: string;
      };
      if (!res.ok) {
        setError(
          ERRORES[json.error ?? ""] ??
            `No se pudo conectar (${json.error ?? res.status}).`,
        );
        return;
      }
      // La contraseña ya está guardada cifrada en el servidor: se borra del navegador.
      setPassword("");
      setUsuario("");
      setAbierto(false);
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  async function desconectar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/apple/connect", { method: "DELETE" });
      if (!res.ok) {
        setError("No se pudo desconectar. Inténtalo de nuevo.");
        return;
      }
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Apple Calendar (iCloud)</p>
            <Badge variant={conectado ? "default" : "outline"}>
              {conectado
                ? "Conectado"
                : existe
                  ? "Reconexión necesaria"
                  : "Sin conectar"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ultimaSincronizacion
              ? `Última sincronización: ${ultimaSincronizacion}`
              : "Sin sincronizar todavía"}
          </p>
        </div>
        <div className="flex gap-2">
          {conectado && (
            <Button
              size="sm"
              variant="ghost"
              onClick={desconectar}
              disabled={enviando}
            >
              Desconectar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
          >
            {conectado ? "Reconectar" : "Conectar"}
          </Button>
        </div>
      </div>

      {abierto && (
        <form
          onSubmit={conectar}
          className="flex flex-col gap-3 rounded-lg border p-4"
          autoComplete="off"
        >
          <p className="text-xs text-muted-foreground">
            Usa una <strong>contraseña específica de aplicación</strong> creada en
            appleid.apple.com, nunca la contraseña de tu Apple ID. Se guarda
            cifrada y la app solo lee tu calendario.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Apple ID
            <input
              type="email"
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="tu-correo@icloud.com"
              autoComplete="off"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Contraseña específica de aplicación
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              autoComplete="off"
              spellCheck={false}
              className="h-9 rounded-md border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-md border p-3 text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={enviando}>
              {enviando ? "Comprobando con iCloud…" : "Guardar y conectar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAbierto(false);
                setError(null);
                setPassword("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {!abierto && error && (
        <p role="alert" className="rounded-md border p-3 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

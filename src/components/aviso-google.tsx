const MENSAJES: Record<string, string> = {
  ok: "Google conectado correctamente.",
  cancelado: "Cancelaste la conexión con Google. Puedes volver a intentarlo.",
  error_estado:
    "La conexión con Google no se pudo verificar (caducó el enlace). Inténtalo de nuevo.",
  permisos_incompletos:
    "Hay que aceptar los dos permisos (Calendar y Gmail, solo lectura). Inténtalo de nuevo.",
  sin_refresh_token:
    "Google no devolvió el permiso de acceso continuo. Inténtalo de nuevo.",
  cuenta_distinta:
    "Conectaste una cuenta de Google distinta a la autorizada. Elige aleix.lozal@gmail.com.",
  error: "No se pudo completar la conexión con Google. Inténtalo de nuevo.",
};

export async function AvisoGoogle({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const { google } = await searchParams;
  const mensaje = typeof google === "string" ? MENSAJES[google] : undefined;
  if (!mensaje) return null;

  return (
    <p role="status" className="rounded-md border p-3 text-sm">
      {mensaje}
    </p>
  );
}

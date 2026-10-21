import "server-only";

import { decrypt, encrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

import { AppleNoConectadoError } from "./errors";

const PROVEEDOR = "apple";

export type CredencialesApple = { usuario: string; password: string };

// Se reutiliza la columna refresh_token_cifrado de "integrations": guarda el
// JSON {usuario, password} cifrado con AES-256-GCM (igual que el token de Google).

export async function guardarCredencialesApple(
  userId: string,
  cred: CredencialesApple,
) {
  const admin = createAdminClient();
  const { error } = await admin.from("integrations").upsert(
    {
      user_id: userId,
      proveedor: PROVEEDOR,
      refresh_token_cifrado: encrypt(JSON.stringify(cred)),
      ultima_sincronizacion: new Date().toISOString(),
    },
    { onConflict: "user_id,proveedor" },
  );
  if (error) throw new Error(`No se pudo guardar la integración: ${error.message}`);
}

export async function leerCredencialesApple(
  userId: string,
): Promise<CredencialesApple> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrations")
    .select("refresh_token_cifrado")
    .eq("user_id", userId)
    .eq("proveedor", PROVEEDOR)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la integración: ${error.message}`);
  if (!data?.refresh_token_cifrado) throw new AppleNoConectadoError();

  const cred = JSON.parse(decrypt(data.refresh_token_cifrado)) as Partial<CredencialesApple>;
  if (!cred.usuario || !cred.password) throw new AppleNoConectadoError();
  return { usuario: cred.usuario, password: cred.password };
}

export async function borrarCredencialesApple(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("proveedor", PROVEEDOR);
  if (error) throw new Error(`No se pudo borrar la integración: ${error.message}`);
}

export async function marcarSincronizacionApple(userId: string) {
  const admin = createAdminClient();
  await admin
    .from("integrations")
    .update({ ultima_sincronizacion: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("proveedor", PROVEEDOR);
}

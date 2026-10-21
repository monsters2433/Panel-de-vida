import "server-only";

import { decrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

import { GoogleNoConectadoError, GoogleReconectarError } from "./errors";
import { refreshAccessToken } from "./oauth";

const PROVEEDOR = "google";
// Renovar si al access token le quedan menos de 60 segundos.
const MARGEN_MS = 60_000;

// Caché en memoria por instancia: evita pedir un token nuevo en cada llamada.
const cache = new Map<string, { token: string; caducaEn: number }>();

/**
 * Devuelve un access token válido, renovándolo con el refresh token
 * (descifrado al vuelo) cuando hace falta. Se llama antes de cada llamada a Google.
 */
export async function getAccessToken(userId: string): Promise<string> {
  const enCache = cache.get(userId);
  if (enCache && enCache.caducaEn - Date.now() > MARGEN_MS) {
    return enCache.token;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrations")
    .select("refresh_token_cifrado")
    .eq("user_id", userId)
    .eq("proveedor", PROVEEDOR)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer la integración: ${error.message}`);
  if (!data?.refresh_token_cifrado) throw new GoogleNoConectadoError();

  try {
    const nuevo = await refreshAccessToken(decrypt(data.refresh_token_cifrado));
    cache.set(userId, {
      token: nuevo.access_token,
      caducaEn: Date.now() + nuevo.expires_in * 1000,
    });
    return nuevo.access_token;
  } catch (e) {
    if (e instanceof GoogleReconectarError) {
      // Token revocado o caducado: se borra para que la interfaz pida reconectar.
      cache.delete(userId);
      await admin
        .from("integrations")
        .update({ refresh_token_cifrado: null })
        .eq("user_id", userId)
        .eq("proveedor", PROVEEDOR);
    }
    throw e;
  }
}

export async function marcarSincronizacion(userId: string) {
  const admin = createAdminClient();
  await admin
    .from("integrations")
    .update({ ultima_sincronizacion: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("proveedor", PROVEEDOR);
}

export async function guardarRefreshToken(
  userId: string,
  refreshTokenCifrado: string,
) {
  const admin = createAdminClient();
  const { error } = await admin.from("integrations").upsert(
    {
      user_id: userId,
      proveedor: PROVEEDOR,
      refresh_token_cifrado: refreshTokenCifrado,
      ultima_sincronizacion: new Date().toISOString(),
    },
    { onConflict: "user_id,proveedor" },
  );
  if (error) throw new Error(`No se pudo guardar la integración: ${error.message}`);
  cache.delete(userId);
}

/** Estado de una integración ("google" o "apple"). No devuelve nunca el token. */
export async function obtenerEstadoIntegracion(
  userId: string,
  proveedor: "google" | "apple" = PROVEEDOR,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrations")
    .select("refresh_token_cifrado, ultima_sincronizacion")
    .eq("user_id", userId)
    .eq("proveedor", proveedor)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la integración: ${error.message}`);

  return {
    conectado: Boolean(data?.refresh_token_cifrado),
    existe: Boolean(data),
    ultimaSincronizacion: (data?.ultima_sincronizacion as string | null) ?? null,
  };
}

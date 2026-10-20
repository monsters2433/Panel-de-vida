"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  const [cargando, setCargando] = useState(false);

  async function entrarConGoogle() {
    setCargando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setCargando(false);
  }

  return (
    <Button
      size="lg"
      className="w-full"
      onClick={entrarConGoogle}
      disabled={cargando}
    >
      {cargando ? "Redirigiendo a Google…" : "Entrar con Google"}
    </Button>
  );
}

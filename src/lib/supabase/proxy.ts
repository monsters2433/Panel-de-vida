import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAllowedEmail } from "@/lib/auth";

// Rutas que se pueden ver sin sesión.
const PUBLIC_PATHS = ["/login", "/acceso-denegado", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function redirectTo(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  // Conserva las cookies de sesión que Supabase haya refrescado.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida el token con Supabase; no fiarse de getSession() aquí.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user) {
    if (isPublic(pathname)) return response;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return redirectTo(request, response, "/login");
  }

  if (!isAllowedEmail(user.email)) {
    if (pathname === "/acceso-denegado" || pathname.startsWith("/auth/")) {
      return response;
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }
    return redirectTo(request, response, "/acceso-denegado");
  }

  if (pathname === "/login") {
    return redirectTo(request, response, "/");
  }

  return response;
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth/auth";

function isBusinessApi(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function authenticationRequiredResponse() {
  return NextResponse.json(
    {
      error: "authentication_required",
      message: "Autenticação necessária para acessar este recurso.",
    },
    { status: 401 },
  );
}

function authUnavailableResponse() {
  return NextResponse.json(
    {
      error: "authentication_unavailable",
      message: "O serviço de autenticação está temporariamente indisponível.",
    },
    { status: 503 },
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Home e documentos legais são públicos. Better Auth e endpoints
  // machine-to-machine com autenticação própria ficam fora deste matcher.
  if (pathname === "/" || pathname === "/terms" || pathname === "/privacy") {
    return NextResponse.next();
  }

  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;

  try {
    session = await auth.api.getSession({
      headers: request.headers,
    });
  } catch {
    if (isBusinessApi(pathname)) {
      return authUnavailableResponse();
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  if (session) {
    return NextResponse.next();
  }

  if (isBusinessApi(pathname)) {
    return authenticationRequiredResponse();
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/((?!api/auth(?:/|$)|api/internal(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};

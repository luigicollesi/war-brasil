import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isBusinessApi(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function hasSessionCookie(request: NextRequest) {
  return Boolean(
    getSessionCookie(request, {
      cookiePrefix: "war-brasil",
    }),
  );
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proxy faz somente uma checagem otimista do cookie para navegação.
  // A sessão real e a autorização continuam sendo validadas perto dos dados,
  // em Server Components e Route Handlers.
  if (pathname === "/" || pathname === "/terms" || pathname === "/privacy") {
    return NextResponse.next();
  }

  if (hasSessionCookie(request)) {
    return NextResponse.next();
  }

  if (isBusinessApi(pathname)) {
    return authenticationRequiredResponse();
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/((?!api/health(?:/|$)|api/auth(?:/|$)|api/internal(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};

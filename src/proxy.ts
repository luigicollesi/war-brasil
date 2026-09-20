import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE_SUFFIX = "war-brasil.session_token";

function isBusinessApi(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      ({ name, value }) =>
        Boolean(value) && name.endsWith(SESSION_COOKIE_SUFFIX),
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

  // O Proxy é apenas uma barreira leve de navegação. Ele nunca consulta
  // Better Auth/PostgreSQL: a validação autoritativa continua nos Route
  // Handlers e Server Components, fora do runtime de Middleware do OpenNext.
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
    "/((?!api/auth(?:/|$)|api/internal(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};

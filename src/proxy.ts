import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ACTIVE_PARTICIPATION_COOKIE,
  activeParticipationTarget,
  parseActiveParticipationHint,
  pathnameMatchesActiveParticipation,
} from "@/src/lib/shared/active-participation";

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

  // Proxy faz somente checagens otimistas de cookies para navegação.
  // A participação e a autorização reais continuam validadas perto dos dados.
  if (pathname === "/terms" || pathname === "/privacy") {
    return NextResponse.next();
  }

  const authenticated = hasSessionCookie(request);
  if (authenticated && !isBusinessApi(pathname)) {
    const participation = parseActiveParticipationHint(
      request.cookies.get(ACTIVE_PARTICIPATION_COOKIE)?.value,
    );
    if (
      participation &&
      !pathnameMatchesActiveParticipation(pathname, participation)
    ) {
      return NextResponse.redirect(
        new URL(activeParticipationTarget(participation), request.url),
      );
    }
  }

  if (pathname === "/") {
    return NextResponse.next();
  }

  if (authenticated) {
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

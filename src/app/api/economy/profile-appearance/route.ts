import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "@/src/lib/server/auth/auth-guard";
import { getProfileAppearanceStorefront } from "@/src/lib/server/economy/profile-appearance-store-service";

export async function GET(request: Request) {
  const session = await getAuthenticatedSession(request);
  if (!session) return authenticationRequiredResponse();

  try {
    const storefront = await getProfileAppearanceStorefront(session.user.id);
    return Response.json(storefront, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[economy] profile appearance storefront failed", error);
    return Response.json(
      {
        error: "PROFILE_APPEARANCE_STOREFRONT_UNAVAILABLE",
        message: "O catálogo de aparência está temporariamente indisponível.",
      },
      { status: 503 },
    );
  }
}

import {
  authenticationRequiredResponse,
  getAuthenticatedSessionForRead,
} from "@/src/lib/server/auth/auth-guard";
import { getPublicProfileAppearance } from "@/src/lib/server/profile/profile-appearance-service";

export async function GET(request: Request) {
  const session = await getAuthenticatedSessionForRead(request);
  if (!session) return authenticationRequiredResponse();

  try {
    const appearance = await getPublicProfileAppearance(session.user.id);
    return Response.json(
      { assetRef: appearance.background.assetRef },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Falha ao carregar background equipado do Profile.", error);
    return Response.json(
      {
        error: "PROFILE_BACKGROUND_UNAVAILABLE",
        message: "O background equipado está temporariamente indisponível.",
      },
      { status: 503 },
    );
  }
}

import "server-only";

import { headers } from "next/headers";
import type {
  PublicCommanderProfileSnapshot,
  PublicPlayerMatchHistory,
} from "@/src/lib/profile/profile-command-contract";
import { auth } from "../auth/auth";
import { getPublicCommanderProfile } from "./profile-service";

function emptyHistory(): PublicPlayerMatchHistory {
  return { matches: [], hasMore: false, nextCursor: null };
}

export async function getPublicCommanderProfileSnapshot(
  handle: string,
): Promise<PublicCommanderProfileSnapshot | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) return null;

  const profile = await getPublicCommanderProfile(session.user.id, handle);
  if (!profile) return null;

  const history = profile.history.data ?? emptyHistory();
  return {
    identity: {
      displayName: profile.identity.displayName,
      handle: profile.identity.handle,
      bio: profile.identity.bio,
      title: profile.identity.title?.name ?? null,
      presence: profile.identity.presence,
      activity: profile.identity.activity,
    },
    relationship: profile.relationship,
    history: profile.history.visible
      ? {
          availability: history.matches.length > 0 ? "available" : "empty",
          source: "match-history",
          data: history,
        }
      : {
          availability: "unavailable",
          source: null,
          unavailableReason: "Este comandante restringiu o acesso ao Livro de Campanha.",
          data: emptyHistory(),
        },
  };
}

import "server-only";

import { headers } from "next/headers";
import type {
  PlayerMatchHistory,
  PlayerSocialSnapshot,
  ProfileCommandSection,
  ProfileCommandSnapshot,
  StoreShowcase,
} from "@/src/lib/profile/profile-command-contract";
import { getCurrentProfileCommandSnapshot as getEvaluationProfileCommandSnapshot } from "@/src/lib/profile/profile-command-data";
import { auth } from "../auth/auth";
import { getCommanderActivity } from "./activity-service";
import { getPlayerMatchHistory } from "./history-service";
import { renewOwnPresence } from "./presence-gateway";
import { getOwnCommanderProfile } from "./profile-service";
import { getPlayerSocialSnapshot } from "./social-read-service";

function unavailableSection<T>(data: T, unavailableReason: string): ProfileCommandSection<T> {
  return {
    availability: "unavailable",
    source: null,
    unavailableReason,
    data,
  };
}

function emptyHistory(): PlayerMatchHistory {
  return { matches: [], hasMore: false, nextCursor: null };
}

function emptySocial(): PlayerSocialSnapshot {
  return {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    blockedCommanders: [],
    recentContacts: [],
    totalFriends: 0,
  };
}

function guestSnapshot(reason: string): ProfileCommandSnapshot {
  return {
    state: "guest",
    identity: unavailableSection(null, reason),
    privacy: unavailableSection(null, "Privacidade indisponível sem identidade autenticada."),
    wallet: unavailableSection(null, "Tesouraria indisponível sem identidade autenticada."),
    social: unavailableSection(emptySocial(), "Rede de Comando indisponível sem identidade autenticada."),
    history: unavailableSection(emptyHistory(), "Livro de Campanha indisponível sem identidade autenticada."),
    storefront: unavailableSection<StoreShowcase>(
      { featuredItems: [] },
      "Intendência indisponível sem identidade autenticada.",
    ),
    isEvaluationFixture: false,
  };
}

export async function getCurrentProfileCommandSnapshot(): Promise<ProfileCommandSnapshot> {
  if (process.env.PROFILE_EVAL_MODE === "1") {
    return getEvaluationProfileCommandSnapshot();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });

  if (!session) {
    return guestSnapshot("Sessão autenticada necessária para abrir o Quartel do Comandante.");
  }

  const profile = await getOwnCommanderProfile(session.user.id);
  if (!profile) {
    return guestSnapshot("Complete a identidade de comando antes de acessar o Quartel.");
  }

  const [activity, history, livePresence] = await Promise.all([
    getCommanderActivity(session.user.id),
    getPlayerMatchHistory(session.user.id, { limit: 20 }),
    renewOwnPresence(session.user.id),
  ]);
  const social = await getPlayerSocialSnapshot(
    session.user.id,
    profile.identity.handle,
    history,
  );

  const historySection: ProfileCommandSnapshot["history"] = {
    availability: history.matches.length > 0 ? "available" : "empty",
    source: "match-history",
    data: history,
  };
  const socialIsEmpty =
    social.totalFriends === 0 &&
    social.incomingRequests.length === 0 &&
    social.outgoingRequests.length === 0 &&
    social.blockedCommanders.length === 0 &&
    social.recentContacts.length === 0;
  const socialSection: ProfileCommandSnapshot["social"] = {
    availability: socialIsEmpty ? "empty" : "available",
    source: "social-service",
    data: social,
  };

  return {
    state: "partial-data",
    identity: {
      availability: "available",
      source: "authenticated-user",
      data: {
        displayName: profile.identity.displayName,
        handle: profile.identity.handle,
        bio: profile.identity.bio,
        title: profile.identity.title?.name ?? null,
        presence: {
          state: livePresence.state,
          lastSeenAt:
            livePresence.lastSeenAt ?? profile.identity.presence.lastSeenAt,
        },
        activity,
      },
    },
    privacy: {
      availability: "available",
      source: "authenticated-user",
      data: profile.privacy,
    },
    wallet: unavailableSection(
      null,
      "Tesouraria ainda não possui uma fonte persistente disponível.",
    ),
    social: socialSection,
    history: historySection,
    storefront: unavailableSection<StoreShowcase>(
      { featuredItems: [] },
      "Intendência ainda não possui uma fonte persistente disponível.",
    ),
    isEvaluationFixture: false,
  };
}

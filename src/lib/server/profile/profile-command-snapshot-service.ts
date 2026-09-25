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
import type { AuthSession } from "../auth/auth";
import { getAuthenticatedSessionForReadHeaders } from "../auth/auth-guard";
import {
  getEconomyStorefront,
  getEconomyWallet,
} from "../economy/economy-service";
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

const PROFILE_SNAPSHOT_PRESENCE_TIMEOUT_MS = 350;

export async function getCurrentProfileCommandSnapshot(
  providedSession?: AuthSession | null,
  options: Readonly<{ includeStorefront?: boolean }> = {},
): Promise<ProfileCommandSnapshot> {
  if (process.env.PROFILE_EVAL_MODE === "1") {
    return getEvaluationProfileCommandSnapshot();
  }

  const session =
    providedSession !== undefined
      ? providedSession
      : await getAuthenticatedSessionForReadHeaders(await headers());

  if (!session) {
    return guestSnapshot("Sessão autenticada necessária para abrir o Quartel do Comandante.");
  }

  const profile = await getOwnCommanderProfile(session.user.id);
  if (!profile) {
    return guestSnapshot("Complete a identidade de comando antes de acessar o Quartel.");
  }

  const includeStorefront = options.includeStorefront !== false;
  const economyRead = includeStorefront
    ? getEconomyStorefront(session.user.id).then((data) => ({
        available: true as const,
        wallet: data.wallet,
        storefront: {
          featuredItems: data.sets.map((set) => ({
            slug: set.slug,
            name: set.name,
            category: "dice-set" as const,
            artworkSrc: set.previewRef,
            artworkAlt: `Prévia do conjunto ${set.name}`,
            status:
              set.status === "available"
                ? "available" as const
                : "announced" as const,
            itemCount: set.items.length,
          })),
        } satisfies StoreShowcase,
      }))
    : getEconomyWallet(session.user.id).then((wallet) => ({
        available: true as const,
        wallet,
        storefront: null,
      }));

  const historyRead = getPlayerMatchHistory(session.user.id, { limit: 20 })
    .then((data) => ({ available: true as const, data }))
    .catch((error: unknown) => {
      console.error("Falha ao carregar histórico no Profile.", error);
      return { available: false as const, data: emptyHistory() };
    });

  const socialRead = getPlayerSocialSnapshot(
    session.user.id,
    profile.identity.handle,
    historyRead.then((result) => result.data),
  )
    .then((data) => ({ available: true as const, data }))
    .catch((error: unknown) => {
      console.error("Falha ao carregar rede social no Profile.", error);
      return { available: false as const, data: emptySocial() };
    });

  const [
    activityResult,
    historyResult,
    livePresence,
    economyResult,
    socialResult,
  ] = await Promise.all([
    getCommanderActivity(session.user.id)
      .then((data) => ({ available: true as const, data }))
      .catch((error: unknown) => {
        console.error("Falha ao carregar atividade no Profile.", error);
        return {
          available: false as const,
          data: { state: "unavailable" as const, matchMode: null },
        };
      }),
    historyRead,
    renewOwnPresence(session.user.id, {
      timeoutMs: PROFILE_SNAPSHOT_PRESENCE_TIMEOUT_MS,
    }),
    economyRead.catch((error: unknown) => {
      console.error("Falha ao carregar economia no Profile.", error);
      return {
        available: false as const,
        wallet: null,
        storefront: null,
      };
    }),
    socialRead,
  ]);

  const historySection: ProfileCommandSnapshot["history"] =
    historyResult.available
      ? {
          availability:
            historyResult.data.matches.length > 0 ? "available" : "empty",
          source: "match-history",
          data: historyResult.data,
        }
      : unavailableSection(
          historyResult.data,
          "Livro de Campanha temporariamente indisponível.",
        );

  const social = socialResult.data;
  const socialIsEmpty =
    social.totalFriends === 0 &&
    social.incomingRequests.length === 0 &&
    social.outgoingRequests.length === 0 &&
    social.blockedCommanders.length === 0 &&
    social.recentContacts.length === 0;
  const socialSection: ProfileCommandSnapshot["social"] =
    socialResult.available
      ? {
          availability: socialIsEmpty ? "empty" : "available",
          source: "social-service",
          data: social,
        }
      : unavailableSection(
          social,
          "Rede de Comando temporariamente indisponível.",
        );

  const walletSection: ProfileCommandSnapshot["wallet"] =
    economyResult.available && economyResult.wallet
      ? {
          availability: "available",
          source: "wallet-service",
          data: { campaignCredit: economyResult.wallet },
        }
    : unavailableSection(
        null,
        "Tesouraria temporariamente indisponível. Os demais sistemas do Quartel continuam operacionais.",
      );

  const storefrontSection: ProfileCommandSnapshot["storefront"] =
    !includeStorefront
      ? {
          availability: "empty",
          source: null,
          data: { featuredItems: [] },
        }
      : economyResult.available && economyResult.storefront
        ? {
            availability:
              economyResult.storefront.featuredItems.length > 0
                ? "available"
                : "empty",
            source: "storefront-service",
            data: economyResult.storefront,
          }
        : unavailableSection<StoreShowcase>(
            { featuredItems: [] },
            "Intendência temporariamente indisponível. Tente novamente mais tarde.",
          );

  const hasPartialData =
    !activityResult.available ||
    !historyResult.available ||
    !socialResult.available ||
    !economyResult.available ||
    livePresence.state === "unavailable";

  return {
    state: hasPartialData ? "partial-data" : "loaded",
    identity: {
      availability: "available",
      source: "authenticated-user",
      data: {
        displayName: profile.identity.displayName,
        handle: profile.identity.handle,
        title: profile.identity.title?.name ?? null,
        presence: {
          state: livePresence.state,
          lastSeenAt:
            livePresence.lastSeenAt ?? profile.identity.presence.lastSeenAt,
        },
        activity: activityResult.data,
      },
    },
    privacy: {
      availability: "available",
      source: "authenticated-user",
      data: profile.privacy,
    },
    wallet: walletSection,
    social: socialSection,
    history: historySection,
    storefront: storefrontSection,
    isEvaluationFixture: false,
  };
}

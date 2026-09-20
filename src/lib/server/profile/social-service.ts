import "server-only";

import type { PoolClient } from "pg";
import { pool } from "../db/pool";
import { findCommanderByHandle } from "./profile-repository";
import {
  cancelPendingRequestsBetween,
  countMutualFriends,
  deleteBlock,
  deleteCanonicalFriendship,
  getSocialRelationship,
  insertBlock,
  insertCanonicalFriendship,
  insertFriendRequest,
  lockPendingReceivedRequest,
  lockPendingSentRequest,
  resolveFriendRequest,
} from "./social-repository";

export type SocialServiceErrorCode =
  | "COMMANDER_NOT_FOUND"
  | "SELF_RELATION_NOT_ALLOWED"
  | "RELATION_BLOCKED"
  | "ALREADY_FRIENDS"
  | "REQUEST_ALREADY_PENDING"
  | "FRIEND_REQUESTS_DISABLED"
  | "MUTUAL_CONTACT_REQUIRED"
  | "REQUEST_NOT_FOUND";

export class SocialServiceError extends Error {
  readonly code: SocialServiceErrorCode;

  constructor(code: SocialServiceErrorCode, message: string) {
    super(message);
    this.name = "SocialServiceError";
    this.code = code;
  }
}

async function withSocialTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const value = await callback(client);
    await client.query("COMMIT");
    transactionOpen = false;
    return value;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function lockAccountPair(
  client: PoolClient,
  userA: string,
  userB: string,
) {
  await client.query(
    `SELECT id
       FROM auth."user"
      WHERE id=ANY($1::uuid[])
      ORDER BY id
      FOR UPDATE`,
    [[userA, userB]],
  );
}

async function requireTargetByHandle(client: PoolClient, handle: string) {
  const target = await findCommanderByHandle(handle.trim(), client);
  if (!target?.handle || !target.display_name) {
    throw new SocialServiceError(
      "COMMANDER_NOT_FOUND",
      "Comandante não encontrado.",
    );
  }
  return target;
}

function rejectSelf(actorUserId: string, targetUserId: string) {
  if (actorUserId === targetUserId) {
    throw new SocialServiceError(
      "SELF_RELATION_NOT_ALLOWED",
      "Não é possível criar uma relação social consigo mesmo.",
    );
  }
}

function mapRequestInsertError(error: unknown): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  ) {
    throw new SocialServiceError(
      "REQUEST_ALREADY_PENDING",
      "Já existe uma solicitação pendente entre estes comandantes.",
    );
  }
  throw error;
}

export async function sendFriendRequest(
  actorUserId: string,
  targetHandle: string,
) {
  return withSocialTransaction(async (client) => {
    const target = await requireTargetByHandle(client, targetHandle);
    rejectSelf(actorUserId, target.user_id);
    await lockAccountPair(client, actorUserId, target.user_id);

    const relationship = await getSocialRelationship(
      actorUserId,
      target.user_id,
      client,
    );
    if (relationship === "blocked") {
      throw new SocialServiceError(
        "RELATION_BLOCKED",
        "A relação entre estes comandantes está bloqueada.",
      );
    }
    if (relationship === "friend") {
      throw new SocialServiceError(
        "ALREADY_FRIENDS",
        "Estes comandantes já são amigos.",
      );
    }
    if (
      relationship === "incoming-request" ||
      relationship === "outgoing-request"
    ) {
      throw new SocialServiceError(
        "REQUEST_ALREADY_PENDING",
        "Já existe uma solicitação pendente entre estes comandantes.",
      );
    }

    if (target.friend_request_policy === "nobody") {
      throw new SocialServiceError(
        "FRIEND_REQUESTS_DISABLED",
        "Este comandante não está aceitando solicitações de amizade.",
      );
    }
    if (target.friend_request_policy === "friends_of_friends") {
      const mutualContacts = await countMutualFriends(
        actorUserId,
        target.user_id,
        client,
      );
      if (mutualContacts < 1) {
        throw new SocialServiceError(
          "MUTUAL_CONTACT_REQUIRED",
          "Este comandante aceita solicitações apenas de contatos em comum.",
        );
      }
    }

    try {
      const requestId = await insertFriendRequest(
        client,
        actorUserId,
        target.user_id,
      );
      return {
        requestId,
        target: {
          handle: target.handle,
          displayName: target.display_name,
        },
      };
    } catch (error) {
      mapRequestInsertError(error);
    }
  });
}

export async function acceptFriendRequest(
  actorUserId: string,
  requestId: string,
) {
  return withSocialTransaction(async (client) => {
    const initial = await client.query<{
      requester_id: string;
      recipient_id: string;
      state: "pending" | "accepted" | "rejected" | "cancelled";
    }>(
      `SELECT requester_id,recipient_id,state
         FROM social.friend_requests
        WHERE id=$1 AND recipient_id=$2`,
      [requestId, actorUserId],
    );
    const existing = initial.rows[0];
    if (!existing) {
      throw new SocialServiceError(
        "REQUEST_NOT_FOUND",
        "Solicitação de amizade não encontrada.",
      );
    }
    if (existing.state === "accepted") {
      return { requestId, accepted: true, alreadyResolved: true } as const;
    }
    if (existing.state !== "pending") {
      throw new SocialServiceError(
        "REQUEST_NOT_FOUND",
        "Solicitação de amizade não está mais pendente.",
      );
    }

    await lockAccountPair(client, existing.requester_id, actorUserId);
    const request = await lockPendingReceivedRequest(
      client,
      requestId,
      actorUserId,
    );
    if (!request) {
      const afterWait = await client.query<{ state: string }>(
        `SELECT state
           FROM social.friend_requests
          WHERE id=$1 AND recipient_id=$2`,
        [requestId, actorUserId],
      );
      if (afterWait.rows[0]?.state === "accepted") {
        return { requestId, accepted: true, alreadyResolved: true } as const;
      }
      throw new SocialServiceError(
        "REQUEST_NOT_FOUND",
        "Solicitação de amizade não está mais pendente.",
      );
    }

    const relationship = await getSocialRelationship(
      actorUserId,
      request.requester_id,
      client,
    );
    if (relationship === "blocked") {
      throw new SocialServiceError(
        "RELATION_BLOCKED",
        "A relação entre estes comandantes está bloqueada.",
      );
    }

    await insertCanonicalFriendship(
      client,
      actorUserId,
      request.requester_id,
    );
    await resolveFriendRequest(client, requestId, "accepted");
    return { requestId, accepted: true, alreadyResolved: false } as const;
  });
}

export async function rejectFriendRequest(
  actorUserId: string,
  requestId: string,
) {
  return withSocialTransaction(async (client) => {
    const initial = await client.query<{ requester_id: string }>(
      `SELECT requester_id
         FROM social.friend_requests
        WHERE id=$1 AND recipient_id=$2 AND state='pending'`,
      [requestId, actorUserId],
    );
    const requesterId = initial.rows[0]?.requester_id;
    if (!requesterId) {
      throw new SocialServiceError(
        "REQUEST_NOT_FOUND",
        "Solicitação de amizade não encontrada.",
      );
    }
    await lockAccountPair(client, requesterId, actorUserId);
    const request = await lockPendingReceivedRequest(client, requestId, actorUserId);
    if (!request) {
      throw new SocialServiceError(
        "REQUEST_NOT_FOUND",
        "Solicitação de amizade não está mais pendente.",
      );
    }
    await resolveFriendRequest(client, requestId, "rejected");
    return { requestId, rejected: true } as const;
  });
}

export async function cancelFriendRequest(
  actorUserId: string,
  requestId: string,
) {
  return withSocialTransaction(async (client) => {
    const initial = await client.query<{ recipient_id: string }>(
      `SELECT recipient_id
         FROM social.friend_requests
        WHERE id=$1 AND requester_id=$2 AND state='pending'`,
      [requestId, actorUserId],
    );
    const recipientId = initial.rows[0]?.recipient_id;
    if (!recipientId) {
      throw new SocialServiceError(
        "REQUEST_NOT_FOUND",
        "Solicitação de amizade não encontrada.",
      );
    }
    await lockAccountPair(client, actorUserId, recipientId);
    const request = await lockPendingSentRequest(client, requestId, actorUserId);
    if (!request) {
      throw new SocialServiceError(
        "REQUEST_NOT_FOUND",
        "Solicitação de amizade não está mais pendente.",
      );
    }
    await resolveFriendRequest(client, requestId, "cancelled");
    return { requestId, cancelled: true } as const;
  });
}

export async function removeFriend(actorUserId: string, targetHandle: string) {
  return withSocialTransaction(async (client) => {
    const target = await requireTargetByHandle(client, targetHandle);
    rejectSelf(actorUserId, target.user_id);
    await lockAccountPair(client, actorUserId, target.user_id);
    const removed = await deleteCanonicalFriendship(
      client,
      actorUserId,
      target.user_id,
    );
    return { removed } as const;
  });
}

export async function blockCommander(
  actorUserId: string,
  targetHandle: string,
) {
  return withSocialTransaction(async (client) => {
    const target = await requireTargetByHandle(client, targetHandle);
    rejectSelf(actorUserId, target.user_id);
    await lockAccountPair(client, actorUserId, target.user_id);
    await insertBlock(client, actorUserId, target.user_id);
    await deleteCanonicalFriendship(client, actorUserId, target.user_id);
    await cancelPendingRequestsBetween(client, actorUserId, target.user_id);
    return { blocked: true } as const;
  });
}

export async function unblockCommander(
  actorUserId: string,
  targetHandle: string,
) {
  return withSocialTransaction(async (client) => {
    const target = await requireTargetByHandle(client, targetHandle);
    rejectSelf(actorUserId, target.user_id);
    await lockAccountPair(client, actorUserId, target.user_id);
    const unblocked = await deleteBlock(client, actorUserId, target.user_id);
    return { unblocked } as const;
  });
}

import "server-only";

import type { AuthenticatedPlayerIdentity } from "../rooms";
import {
  createRoom,
  joinRoomWithClient,
  RoomError,
} from "../rooms";
import { pool } from "../db/pool";
import {
  findCommanderByHandle,
  type ProfileQueryable,
} from "../profile/profile-repository";
import { getSocialRelationship } from "../profile/social-repository";
import {
  deleteWaitingRoomOwnedByUser,
  expireStaleInvitations,
  findPendingInvitationBetween,
  insertRoomInvitation,
  listIncomingRoomInvitations,
  listOutgoingRoomInvitations,
  lockIncomingRoomInvitation,
  lockOutgoingRoomInvitation,
  resolveRoomInvitation,
} from "./invitation-repository";
import { insertInvitationRejectedNotification } from "../profile/notification-repository";

const INVITATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class GameInvitationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "GameInvitationError";
  }
}

function normalizeInvitationId(value: string) {
  const id = value.trim();
  if (!INVITATION_ID_PATTERN.test(id)) {
    throw new GameInvitationError(
      "INVALID_INVITATION_ID",
      "Convite de partida inválido.",
      400,
    );
  }
  return id;
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505",
  );
}

async function requireFriendRelationship(
  actorUserId: string,
  targetUserId: string,
  db: ProfileQueryable = pool,
) {
  const relationship = await getSocialRelationship(
    actorUserId,
    targetUserId,
    db,
  );
  if (relationship !== "friend") {
    throw new GameInvitationError(
      "GAME_INVITATION_FRIEND_REQUIRED",
      "Somente comandantes aliados podem trocar convites de partida.",
      409,
    );
  }
}

export async function createFriendRoomInvitation(input: Readonly<{
  actorUserId: string;
  targetHandle: string;
  playerSession: string;
  identity: AuthenticatedPlayerIdentity;
}>) {
  const target = await findCommanderByHandle(input.targetHandle);
  if (!target?.handle || !target.display_name) {
    throw new GameInvitationError(
      "INVITEE_NOT_FOUND",
      "Comandante não encontrado.",
      404,
    );
  }
  if (target.user_id === input.actorUserId) {
    throw new GameInvitationError(
      "SELF_INVITATION_FORBIDDEN",
      "Não é possível convidar a própria conta.",
      409,
    );
  }

  await requireFriendRelationship(input.actorUserId, target.user_id);
  await expireStaleInvitations(input.actorUserId);

  const existing = await findPendingInvitationBetween(
    input.actorUserId,
    target.user_id,
  );
  if (existing) {
    return {
      invitationId: existing.id,
      roomCode: existing.room_code,
      expiresAt: existing.expires_at.toISOString(),
      target: {
        handle: target.handle,
        displayName: target.display_name,
      },
      reused: true,
    };
  }

  const room = await createRoom(input.playerSession, input.identity);
  try {
    const invitation = await insertRoomInvitation(
      room.id,
      room.code,
      input.actorUserId,
      target.user_id,
    );
    return {
      invitationId: invitation.id,
      roomCode: room.code,
      expiresAt: invitation.expires_at.toISOString(),
      target: {
        handle: target.handle,
        displayName: target.display_name,
      },
    };
  } catch (error) {
    await deleteWaitingRoomOwnedByUser(room.id, input.actorUserId).catch(
      () => undefined,
    );
    if (isUniqueViolation(error)) {
      throw new GameInvitationError(
        "GAME_INVITATION_ALREADY_PENDING",
        "Já existe um convite de partida pendente entre estes comandantes.",
        409,
      );
    }
    throw error;
  }
}

export async function listGameInvitations(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    listIncomingRoomInvitations(userId),
    listOutgoingRoomInvitations(userId),
  ]);
  return { incoming, outgoing };
}

export async function acceptGameInvitation(input: Readonly<{
  inviteeUserId: string;
  invitationId: string;
  playerSession: string;
  identity: AuthenticatedPlayerIdentity;
}>) {
  const invitationId = normalizeInvitationId(input.invitationId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const invitation = await lockIncomingRoomInvitation(
      invitationId,
      input.inviteeUserId,
      client,
    );
    if (!invitation) {
      throw new GameInvitationError(
        "GAME_INVITATION_NOT_FOUND",
        "Convite de partida não encontrado.",
        404,
      );
    }

    if (invitation.state !== "pending") {
      throw new GameInvitationError(
        "GAME_INVITATION_UNAVAILABLE",
        "Este convite de partida não está mais disponível.",
        409,
      );
    }

    if (invitation.expires_at.getTime() <= Date.now()) {
      await resolveRoomInvitation(invitation.id, "expired", client);
      await client.query("COMMIT");
      throw new GameInvitationError(
        "GAME_INVITATION_EXPIRED",
        "Este convite de partida expirou.",
        409,
      );
    }

    if (!invitation.room_exists) {
      await resolveRoomInvitation(
        invitation.id,
        "cancelled",
        client,
        "room_deleted",
      );
      await client.query("COMMIT");
      throw new GameInvitationError(
        "GAME_INVITATION_ROOM_NOT_FOUND",
        "Essa sala já foi encerrada.",
        409,
      );
    }

    if (invitation.room_status !== "waiting") {
      await resolveRoomInvitation(
        invitation.id,
        "cancelled",
        client,
        "room_started",
      );
      await client.query("COMMIT");
      throw new GameInvitationError(
        "GAME_INVITATION_ROOM_STARTED",
        "A partida dessa sala já começou.",
        409,
      );
    }

    await requireFriendRelationship(
      input.inviteeUserId,
      invitation.inviter_user_id,
      client,
    );

    try {
      await joinRoomWithClient(
        client,
        invitation.room_code,
        input.playerSession,
        input.identity,
      );
    } catch (error) {
      if (
        error instanceof RoomError &&
        error.debug?.reason === "room_full"
      ) {
        await resolveRoomInvitation(
          invitation.id,
          "cancelled",
          client,
          "room_full",
        );
        await client.query("COMMIT");
        throw new GameInvitationError(
          "GAME_INVITATION_ROOM_FULL",
          "A sala atingiu o limite de jogadores.",
          409,
        );
      }
      if (
        error instanceof RoomError &&
        error.debug?.reason === "room_started"
      ) {
        await resolveRoomInvitation(
          invitation.id,
          "cancelled",
          client,
          "room_started",
        );
        await client.query("COMMIT");
        throw new GameInvitationError(
          "GAME_INVITATION_ROOM_STARTED",
          "A partida dessa sala já começou.",
          409,
        );
      }
      throw error;
    }

    await resolveRoomInvitation(
      invitation.id,
      "accepted",
      client,
      "accepted",
    );
    await client.query("COMMIT");
    return { invitationId: invitation.id, roomCode: invitation.room_code };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectGameInvitation(
  inviteeUserId: string,
  invitationIdValue: string,
) {
  const invitationId = normalizeInvitationId(invitationIdValue);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const invitation = await lockIncomingRoomInvitation(
      invitationId,
      inviteeUserId,
      client,
    );
    if (!invitation || invitation.state !== "pending") {
      throw new GameInvitationError(
        "GAME_INVITATION_NOT_FOUND",
        "Convite de partida pendente não encontrado.",
        404,
      );
    }
    await resolveRoomInvitation(
      invitationId,
      "rejected",
      client,
      "rejected",
    );
    await insertInvitationRejectedNotification(invitationId, client);
    await client.query("COMMIT");
    return { invitationId, rejected: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelGameInvitation(
  inviterUserId: string,
  invitationIdValue: string,
) {
  const invitationId = normalizeInvitationId(invitationIdValue);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const invitation = await lockOutgoingRoomInvitation(
      invitationId,
      inviterUserId,
      client,
    );
    if (!invitation || invitation.state !== "pending") {
      throw new GameInvitationError(
        "GAME_INVITATION_NOT_FOUND",
        "Convite de partida pendente não encontrado.",
        404,
      );
    }
    await resolveRoomInvitation(
      invitationId,
      "cancelled",
      client,
      "cancelled",
    );
    await client.query("COMMIT");
    return { invitationId, cancelled: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

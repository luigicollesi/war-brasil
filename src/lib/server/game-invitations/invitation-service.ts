import "server-only";

import type { AuthenticatedPlayerIdentity } from "../rooms";
import { createRoom, joinRoom } from "../rooms";
import { pool } from "../db/pool";
import {
  findCommanderByHandle,
  type ProfileQueryable,
} from "../profile/profile-repository";
import { getSocialRelationship } from "../profile/social-repository";
import {
  deleteWaitingRoomOwnedByUser,
  expireStaleInvitations,
  insertRoomInvitation,
  listIncomingRoomInvitations,
  lockIncomingRoomInvitation,
  lockOutgoingRoomInvitation,
  resolveRoomInvitation,
} from "./invitation-repository";

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

  const room = await createRoom(input.playerSession, input.identity);
  try {
    const invitation = await insertRoomInvitation(
      room.id,
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

export async function listIncomingGameInvitations(userId: string) {
  return listIncomingRoomInvitations(userId);
}

async function validateIncomingInvitation(
  inviteeUserId: string,
  invitationId: string,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const invitation = await lockIncomingRoomInvitation(
      normalizeInvitationId(invitationId),
      inviteeUserId,
      client,
    );
    if (!invitation) {
      throw new GameInvitationError(
        "GAME_INVITATION_NOT_FOUND",
        "Convite de partida não encontrado.",
        404,
      );
    }

    if (
      invitation.state !== "pending" ||
      invitation.expires_at.getTime() <= Date.now()
    ) {
      if (
        invitation.state === "pending" &&
        invitation.expires_at.getTime() <= Date.now()
      ) {
        await resolveRoomInvitation(invitation.id, "expired", client);
      }
      throw new GameInvitationError(
        "GAME_INVITATION_EXPIRED",
        "Este convite de partida não está mais disponível.",
        409,
      );
    }
    if (invitation.room_status !== "waiting") {
      await resolveRoomInvitation(invitation.id, "cancelled", client);
      throw new GameInvitationError(
        "GAME_INVITATION_ROOM_UNAVAILABLE",
        "A sala vinculada a este convite não está mais disponível.",
        409,
      );
    }

    await requireFriendRelationship(
      inviteeUserId,
      invitation.inviter_user_id,
      client,
    );
    await client.query("COMMIT");
    return invitation;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function acceptGameInvitation(input: Readonly<{
  inviteeUserId: string;
  invitationId: string;
  playerSession: string;
  identity: AuthenticatedPlayerIdentity;
}>) {
  const invitation = await validateIncomingInvitation(
    input.inviteeUserId,
    input.invitationId,
  );

  await joinRoom(invitation.room_code, input.playerSession, input.identity);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await lockIncomingRoomInvitation(
      invitation.id,
      input.inviteeUserId,
      client,
    );
    if (!locked) {
      throw new GameInvitationError(
        "GAME_INVITATION_NOT_FOUND",
        "Convite de partida não encontrado.",
        404,
      );
    }
    if (locked.state === "pending") {
      await resolveRoomInvitation(locked.id, "accepted", client);
    } else if (locked.state !== "accepted") {
      throw new GameInvitationError(
        "GAME_INVITATION_UNAVAILABLE",
        "O convite foi resolvido antes da entrada na sala.",
        409,
      );
    }
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
    await resolveRoomInvitation(invitationId, "rejected", client);
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
    await resolveRoomInvitation(invitationId, "cancelled", client);
    await client.query("COMMIT");
    return { invitationId, cancelled: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

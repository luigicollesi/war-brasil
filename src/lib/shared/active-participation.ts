export const ACTIVE_PARTICIPATION_COOKIE =
  "war_brasil_active_participation";

export type ActiveParticipationKind = "lobby" | "game";

export type ActiveParticipationHint = Readonly<{
  kind: ActiveParticipationKind;
  roomCode: string;
}>;

const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function activeParticipationTarget(
  participation: ActiveParticipationHint,
) {
  const prefix = participation.kind === "lobby" ? "/lobby" : "/game";
  return `${prefix}/${participation.roomCode}`;
}

export function serializeActiveParticipationHint(
  participation: ActiveParticipationHint,
) {
  return `${participation.kind}:${participation.roomCode.toUpperCase()}`;
}

export function parseActiveParticipationHint(
  value: string | null | undefined,
): ActiveParticipationHint | null {
  if (!value) return null;
  const [kind, roomCode, ...rest] = value.split(":");
  if (
    rest.length > 0 ||
    (kind !== "lobby" && kind !== "game") ||
    !ROOM_CODE_PATTERN.test(roomCode ?? "")
  ) {
    return null;
  }

  return {
    kind,
    roomCode: roomCode.toUpperCase(),
  };
}

export function pathnameMatchesActiveParticipation(
  pathname: string,
  participation: ActiveParticipationHint,
) {
  return pathname.toUpperCase() ===
    activeParticipationTarget(participation).toUpperCase();
}

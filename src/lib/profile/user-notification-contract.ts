export type UserNotificationKind =
  | "game_invitation_rejected"
  | "game_invitation_cancelled";

export type UserNotification = Readonly<{
  id: string;
  kind: UserNotificationKind;
  entityId: string | null;
  payload: Readonly<Record<string, string>>;
  createdAt: string;
  expiresAt: string | null;
}>;

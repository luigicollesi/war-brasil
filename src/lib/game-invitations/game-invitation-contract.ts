export type GameInvitationState =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "expired";

export type GameInvitationSummary = Readonly<{
  id: string;
  roomCode: string;
  inviter: Readonly<{
    handle: string;
    displayName: string;
  }>;
  invitee: Readonly<{
    handle: string;
    displayName: string;
  }>;
  state: GameInvitationState;
  createdAt: string;
  expiresAt: string;
}>;

export type OperationStatus =
  | "idle"
  | "creating"
  | "create-error"
  | "joining"
  | "invalid-code"
  | "network-error"
  | "join-error"
  | "success-transition";

export type OperationInteraction =
  | "idle"
  | "create-focus"
  | "join-focus"
  | "typing-code";

export type OperationStatusChange = (status: OperationStatus) => void;
export type OperationInteractionChange = (
  interaction: OperationInteraction,
) => void;

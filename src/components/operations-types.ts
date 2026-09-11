export type OperationStatus =
  | "idle"
  | "pending"
  | "invalid-code"
  | "network-error"
  | "error"
  | "success";

export type OperationInteraction =
  | "idle"
  | "create-focus"
  | "join-focus"
  | "typing-code";

export type OperationStatusChange = (status: OperationStatus) => void;
export type OperationInteractionChange = (
  interaction: OperationInteraction,
) => void;

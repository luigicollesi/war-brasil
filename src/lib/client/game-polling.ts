type GamePollContext = {
  visible: boolean;
  online: boolean;
  failures: number;
  presentationPending: boolean;
};

const ACTIVE_POLL_MS = 1_000;
const ACTIVE_AUTOMATION_POLL_MS = 1_500;
const HIDDEN_POLL_MS = 5_000;
const HIDDEN_PRESENTATION_POLL_MS = 2_500;
const OFFLINE_POLL_MS = 15_000;

export function nextGamePollDelay({
  visible,
  online,
  failures,
  presentationPending,
}: GamePollContext) {
  if (!online) return OFFLINE_POLL_MS;

  if (failures > 0) {
    return Math.min(ACTIVE_POLL_MS * 2 ** Math.min(failures, 4), OFFLINE_POLL_MS);
  }

  if (!visible) {
    return presentationPending ? HIDDEN_PRESENTATION_POLL_MS : HIDDEN_POLL_MS;
  }

  return presentationPending ? ACTIVE_AUTOMATION_POLL_MS : ACTIVE_POLL_MS;
}

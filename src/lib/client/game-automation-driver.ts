export type GameAutomationDriver = "browser" | "server";

export function gameAutomationDriver(
  value = process.env.NEXT_PUBLIC_GAME_AUTOMATION_DRIVER,
): GameAutomationDriver {
  return value === "server" ? "server" : "browser";
}

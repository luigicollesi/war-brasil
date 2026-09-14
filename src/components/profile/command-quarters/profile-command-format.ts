import type {
  CommanderActivity,
  CommanderPresence,
  PlayerPresenceState,
} from "@/src/lib/profile/profile-command-contract";

export const PRESENCE_COPY: Readonly<Record<PlayerPresenceState, string>> = {
  online: "Disponível",
  offline: "Offline",
  unavailable: "Presença indisponível",
};

export function commanderStatusLabel(
  presence: CommanderPresence,
  activity: CommanderActivity,
) {
  if (activity.state === "match") return "Em partida";
  if (activity.state === "lobby") return "Em sala";
  return PRESENCE_COPY[presence.state];
}

export function initialsFrom(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
      .join("") || "WB"
  );
}

export function formatBalance(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatOperationDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(" de ", " ")
    .toLocaleUpperCase("pt-BR");
}

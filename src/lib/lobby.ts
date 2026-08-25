export const PLAYER_COLORS = [
  { value: "forest", label: "Verde", hex: "#3f8b68" },
  { value: "ocean", label: "Azul", hex: "#3984c6" },
  { value: "sun", label: "Amarelo", hex: "#d5a937" },
  { value: "ruby", label: "Vermelho", hex: "#bf4d4d" },
  { value: "violet", label: "Roxo", hex: "#8054aa" },
  { value: "orange", label: "Laranja", hex: "#d97632" },
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number]["value"];

export type LobbyPlayer = {
  id: string;
  factionName: string;
  color: PlayerColor;
  isReady: boolean;
  isMe: boolean;
};

export type LobbySnapshot = {
  room: {
    id: string;
    code: string;
    status: "waiting" | "order_roll" | "playing";
    createdAt: string;
    startedAt: string | null;
  };
  players: LobbyPlayer[];
  me: LobbyPlayer;
};

export function isPlayerColor(value: unknown): value is PlayerColor {
  return PLAYER_COLORS.some((color) => color.value === value);
}

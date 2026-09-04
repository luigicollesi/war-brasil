"use client";

export type GameEphemeralEvent = {
  type: string;
  roomId: string;
  payload: unknown;
};

export type GameEphemeralListener = (event: GameEphemeralEvent) => void;

export interface GameEphemeralTransport {
  connect(roomId: string): Promise<void>;
  send(event: GameEphemeralEvent): void;
  subscribe(listener: GameEphemeralListener): () => void;
  disconnect(): void;
}

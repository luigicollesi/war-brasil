import type {
  GamePlayer,
  GameSnapshot,
  GameTerritory,
} from "./game-contract";
import type { TerritoryConnection } from "./territory-connections";

export type GameViewModel = {
  me: GamePlayer | undefined;
  playersById: Map<string, GamePlayer>;
  territoriesById: Map<number, GameTerritory>;
  myTerritories: GameTerritory[];
  connectionsByTerritory: Map<number, TerritoryConnection[]>;
};

export function buildGameViewModel(snapshot: GameSnapshot): GameViewModel {
  const playersById = new Map(
    snapshot.players.map((player) => [player.id, player] as const),
  );
  const territoriesById = new Map(
    snapshot.territories.map((territory) => [territory.territoryId, territory] as const),
  );
  const me = snapshot.players.find((player) => player.isMe);
  const myTerritories = me
    ? snapshot.territories.filter(
        (territory) => territory.ownerPlayerId === me.id,
      )
    : [];
  const connectionsByTerritory = new Map<number, TerritoryConnection[]>();

  for (const connection of snapshot.connections) {
    for (const territoryId of [connection.territoryA, connection.territoryB]) {
      const current = connectionsByTerritory.get(territoryId);
      if (current) current.push(connection);
      else connectionsByTerritory.set(territoryId, [connection]);
    }
  }

  return {
    me,
    playersById,
    territoriesById,
    myTerritories,
    connectionsByTerritory,
  };
}

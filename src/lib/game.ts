import "server-only";

import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/src/lib/db/pool";
import { TERRITORY_METADATA, type CardSymbol, type Region } from "@/src/lib/game-config";
import { isValidTrade, reinforcementFor, resolveBattle, tradeValue } from "@/src/lib/game-rules";
import type { PlayerColor } from "@/src/lib/lobby";
import { RoomError } from "@/src/lib/rooms";
import type { TerritoryConnection } from "@/src/lib/territory-connections";
import { getTerritoryConnection } from "@/src/lib/territory-connections.server";

type Status = "order_roll" | "playing" | "finished";
export type GamePhase = "cards" | "reinforcement" | "attack" | "maneuver" | "end_turn" | "finished";
type Room = { id:string; code:string; status:Status; order_roll_round:number; phase:GamePhase; current_player_id:string|null; turn_number:number; reinforcements_remaining:number; conquered_this_turn:boolean; trade_count:number; winner_player_id:string|null; pending_from_territory_id:number|null; pending_to_territory_id:number|null; last_battle:Battle|null };
type Player = { id:string; faction_name:string; color:PlayerColor; turn_position:number|null; is_me?:boolean };
type Territory = { territory_id:number; owner_player_id:string; color:PlayerColor; troops:number; moved_in_turn:number };
type LockedTerritory = Omit<Territory, "color">;
type Roll = { player_id:string; roll_round:number; value:number; rolled_at:Date };
type Card = { id:string; territory_id:number|null; symbol:CardSymbol|null; is_wild:boolean };
type Objective = { id:string; type:string; name:string; description:string; params:Record<string, unknown>; target_player_id:string|null; target_name:string|null };

type BattleStage = "awaiting_attacker_roll" | "show_attacker_result" | "awaiting_defender_roll" | "show_defender_result" | "show_comparison" | "show_battle_result";
type BattleResult = { attacker:number[]; defender:number[]; attackerLosses:number; defenderLosses:number; conquered:boolean };
type Battle = BattleResult & { attackerTerritoryId:number; defenderTerritoryId:number; attackerPlayerId:string; defenderPlayerId:string; stage:BattleStage; stageStartedAt:string; attackerTroopsAfter?:number; defenderTroopsAfter?:number };
export type GameSnapshot = {
  room:{id:string;code:string;status:Status;orderRollRound:number;orderRollPlayerId:string|null;lastOrderRollPlayerId:string|null;phase:GamePhase;currentPlayerId:string|null;turnNumber:number;reinforcementsRemaining:number;winnerPlayerId:string|null;pendingConquest:{fromTerritoryId:number;toTerritoryId:number}|null;battle:Battle|null};
  players:Array<{id:string;factionName:string;color:PlayerColor;turnPosition:number|null;isMe:boolean;rolls:Array<{round:number;value:number}>}>;
  territories:Array<{territoryId:number;ownerPlayerId:string;ownerColor:PlayerColor;troops:number;movedInTurn:number}>;
  eligiblePlayerIds:string[];
  connections: TerritoryConnection[];
  myCards:Array<{id:string;territoryId:number|null;symbol:CardSymbol|"wild"}>;
  myObjective:{id:string;name:string;description:string;targetFactionName:string|null}|null;
};

const roomFields = "id, code, status, order_roll_round, phase, current_player_id, turn_number, reinforcements_remaining, conquered_this_turn, trade_count, winner_player_id, pending_from_territory_id, pending_to_territory_id, last_battle";
function roomId(value:string) { if (!/^\d+$/.test(value)) throw new RoomError("Partida não encontrada.", 404); return value; }
function integer(value:unknown, message:string) { if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new RoomError(message, 422); return value; }
async function transaction<T>(fn:(client:PoolClient)=>Promise<T>) { const client=await pool.connect(); try { await client.query("BEGIN"); const result=await fn(client); await client.query("COMMIT"); return result; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
async function lockedRoom(client:PoolClient, id:string) { const result=await client.query<Room>(`SELECT ${roomFields} FROM game_rooms WHERE id=$1 FOR UPDATE`,[id]); if(!result.rows[0]) throw new RoomError("Partida não encontrada.",404); return result.rows[0]; }
async function playerFor(client:PoolClient, room:Room, session:string) { const result=await client.query<Player>("SELECT id, faction_name, color, turn_position FROM room_players WHERE room_id=$1 AND player_session=$2 FOR UPDATE",[room.id,session]); if(!result.rows[0]) throw new RoomError("Você não pertence a esta partida.",403); return result.rows[0]; }
function assertTurn(room:Room, player:Player, phase:GamePhase) { if(room.status!=="playing"||room.phase!==phase||room.current_player_id!==player.id) throw new RoomError("Esta ação não está disponível neste momento.",409,{roomStatus:room.status,roomPhase:room.phase,expectedPhase:phase,currentPlayerId:room.current_player_id,requestPlayerId:player.id}); }
function histories(players:Player[], rolls:Roll[]) { const values=new Map(players.map(player=>[player.id,[] as number[]])); for(const roll of rolls) values.get(roll.player_id)?.push(roll.value); return values; }
function unresolved(values:Map<string,number[]>) { const groups=new Map<string,string[]>(); for(const [id,history] of values) { const key=history.join(","); groups.set(key,[...(groups.get(key)??[]),id]); } return [...groups.values()].filter(group=>group.length>1).flat(); }
function eligible(players:Player[], rolls:Roll[], round:number) { return unresolved(histories(players,rolls.filter(roll=>roll.roll_round<round))); }
function compare(a:number[],b:number[]) { for(let i=0;i<Math.max(a.length,b.length);i+=1) { const difference=(b[i]??-1)-(a[i]??-1); if(difference) return difference; } return 0; }
const ORDER_ROLL_PRESENTATION_MS=2_000;
const BATTLE_PRESENTATION_MS=2_000;
function isBattle(value:Battle|null): value is Battle { return Boolean(value&&"stage" in value&&"attackerTerritoryId" in value&&"defenderTerritoryId" in value); }
function battleExpired(battle:Battle) { return Date.now()-Date.parse(battle.stageStartedAt)>=BATTLE_PRESENTATION_MS; }
async function saveBattle(client:PoolClient,room:Room,battle:Battle|null) { await client.query("UPDATE game_rooms SET last_battle=$2 WHERE id=$1",[room.id,battle?JSON.stringify(battle):null]); room.last_battle=battle; }

async function objectiveWon(client:PoolClient, room:Room, playerId:string) {
  const objective=(await client.query<Objective>(`SELECT o.id,o.type,o.name,o.description,o.params,a.target_player_id,t.faction_name target_name FROM game_player_objectives a JOIN objectives o ON o.id=a.objective_id LEFT JOIN room_players t ON t.id=a.target_player_id WHERE a.room_id=$1 AND a.player_id=$2`,[room.id,playerId])).rows[0];
  if(!objective) return false;
  const territories=(await client.query<{territory_id:number;troops:number;owner_player_id:string}>("SELECT territory_id,troops,owner_player_id FROM game_territories WHERE room_id=$1",[room.id])).rows;
  const owned=territories.filter(territory=>territory.owner_player_id===playerId);
  const number=(key:string)=>typeof objective.params[key]==="number"?objective.params[key]:0;
  let won=false;
  if(objective.type==="territories") won=owned.length>=number("territories");
  else if(objective.type==="fortification") won=owned.filter(territory=>territory.troops>=number("minTroops")).length>=number("territories");
  else if(objective.type==="elimination"||objective.type==="elimination_plus") { won=Boolean(objective.target_player_id)&&!territories.some(territory=>territory.owner_player_id===objective.target_player_id); if(won&&objective.type==="elimination_plus") won=owned.length>=(number("territories")||1); }
  else {
    const required=Array.isArray(objective.params.regions)?objective.params.regions.filter((region):region is Region=>typeof region==="string"&&["norte","nordeste","centro-oeste","sudeste","sul"].includes(region)):[];
    const ownedIds=new Set(owned.map(territory=>territory.territory_id));
    const full=(Object.keys(TERRITORY_METADATA) as unknown as number[]).reduce<Region[]>((regions,id)=>{ const region=TERRITORY_METADATA[id].region; const ids=Object.entries(TERRITORY_METADATA).filter(([,territory])=>territory.region===region).map(([territoryId])=>Number(territoryId)); if(!regions.includes(region)&&ids.every(territoryId=>ownedIds.has(territoryId))) regions.push(region); return regions; },[]);
    won=required.every(region=>full.includes(region));
    const extra=number("additionalAnyRegion"); if(extra) won&&=full.filter(region=>!required.includes(region)).length>=extra;
    if(objective.type==="presence"||objective.type==="network") won&&=owned.length>=(number("territories")||1);
  }
  if(won) await client.query("UPDATE game_rooms SET status='finished',phase='finished',winner_player_id=$2 WHERE id=$1",[room.id,playerId]);
  return won;
}
async function resolveFallbacks(client:PoolClient, room:string, target:string) { await client.query("UPDATE game_player_objectives a SET objective_id=o.fallback_objective_id,target_player_id=NULL FROM objectives o WHERE a.objective_id=o.id AND a.room_id=$1 AND a.target_player_id=$2 AND o.fallback_objective_id IS NOT NULL",[room,target]); }

async function applyBattleOutcome(client:PoolClient,room:Room,battle:Battle) {
  const rows=(await client.query<LockedTerritory>("SELECT territory_id,owner_player_id,troops,moved_in_turn FROM game_territories WHERE room_id=$1 AND territory_id=ANY($2::smallint[]) FOR UPDATE",[room.id,[battle.attackerTerritoryId,battle.defenderTerritoryId]])).rows;
  const attacker=rows.find(row=>row.territory_id===battle.attackerTerritoryId),defender=rows.find(row=>row.territory_id===battle.defenderTerritoryId);
  if(!attacker||!defender||attacker.owner_player_id!==battle.attackerPlayerId||defender.owner_player_id!==battle.defenderPlayerId) throw new RoomError("O estado do combate foi alterado antes da resolução.",409,{battle});
  const attackerTroops=attacker.troops-battle.attackerLosses,defenderTroops=defender.troops-battle.defenderLosses;
  await client.query("UPDATE game_territories SET troops=$3,moved_in_turn=0 WHERE room_id=$1 AND territory_id=$2",[room.id,attacker.territory_id,attackerTroops]);
  battle.attackerTroopsAfter=attackerTroops; battle.defenderTroopsAfter=Math.max(0,defenderTroops);
  if(defenderTroops>0) { await client.query("UPDATE game_territories SET troops=$3 WHERE room_id=$1 AND territory_id=$2",[room.id,defender.territory_id,defenderTroops]); await objectiveWon(client,room,battle.attackerPlayerId); return; }
  await client.query("UPDATE game_territories SET owner_player_id=$3,troops=1,moved_in_turn=0 WHERE room_id=$1 AND territory_id=$2",[room.id,defender.territory_id,battle.attackerPlayerId]);
  await client.query("UPDATE game_rooms SET conquered_this_turn=TRUE,pending_from_territory_id=$2,pending_to_territory_id=$3 WHERE id=$1",[room.id,battle.attackerTerritoryId,battle.defenderTerritoryId]);
  room.pending_from_territory_id=battle.attackerTerritoryId; room.pending_to_territory_id=battle.defenderTerritoryId;
  const defenderStillHasTerritory=await client.query("SELECT 1 FROM game_territories WHERE room_id=$1 AND owner_player_id=$2 LIMIT 1",[room.id,battle.defenderPlayerId]);
  if(!defenderStillHasTerritory.rowCount) { await client.query("UPDATE game_cards SET owner_player_id=$3 WHERE room_id=$1 AND owner_player_id=$2 AND zone='hand'",[room.id,battle.defenderPlayerId,battle.attackerPlayerId]); if(!await objectiveWon(client,room,battle.attackerPlayerId)) await resolveFallbacks(client,room.id,battle.defenderPlayerId); } else await objectiveWon(client,room,battle.attackerPlayerId);
}

async function advanceBattlePresentation(client:PoolClient,room:Room) {
  const battle=room.last_battle;
  if(!isBattle(battle)||!battleExpired(battle)) return;
  if(battle.stage==="show_attacker_result") { battle.stage="awaiting_defender_roll"; battle.stageStartedAt=new Date().toISOString(); await saveBattle(client,room,battle); return; }
  if(battle.stage==="show_defender_result") { battle.stage="show_comparison"; battle.stageStartedAt=new Date().toISOString(); await saveBattle(client,room,battle); return; }
  if(battle.stage==="show_comparison") { await applyBattleOutcome(client,room,battle); battle.stage="show_battle_result"; battle.stageStartedAt=new Date().toISOString(); await saveBattle(client,room,battle); return; }
  if(battle.stage==="show_battle_result"&&!room.pending_from_territory_id) await saveBattle(client,room,null);
}

async function advanceOrderRollPresentation(client:PoolClient,room:Room) {
  if(room.status!=="order_roll") return;

  const players=(await client.query<Player>(
    "SELECT id,faction_name,color,turn_position FROM room_players WHERE room_id=$1 ORDER BY joined_at",
    [room.id],
  )).rows;

  const rolls=(await client.query<Roll>(
    "SELECT player_id,roll_round,value,rolled_at FROM game_order_rolls WHERE room_id=$1 ORDER BY roll_round,rolled_at",
    [room.id],
  )).rows;

  const current=eligible(players,rolls,room.order_roll_round);
  if(!current.length) return;

  const currentRolls=rolls.filter(
    roll=>roll.roll_round===room.order_roll_round&&current.includes(roll.player_id),
  );

  const allRolled=current.every(
    playerId=>currentRolls.some(roll=>roll.player_id===playerId),
  );

  if(!allRolled) return;

  const lastRollAt=currentRolls.reduce(
    (latest,roll)=>Math.max(latest,roll.rolled_at.getTime()),
    0,
  );

  if(!lastRollAt||Date.now()-lastRollAt<ORDER_ROLL_PRESENTATION_MS) return;

  const historiesByPlayer=histories(players,rolls);

  if(unresolved(historiesByPlayer).length) {
    await client.query(
      "UPDATE game_rooms SET order_roll_round=order_roll_round+1 WHERE id=$1",
      [room.id],
    );
    room.order_roll_round+=1;
    return;
  }

  const order=[...players].sort(
    (a,b)=>compare(historiesByPlayer.get(a.id)??[],historiesByPlayer.get(b.id)??[]),
  );

  for(const [index,ordered] of order.entries()) {
    await client.query(
      "UPDATE room_players SET turn_position=$1 WHERE id=$2",
      [index+1,ordered.id],
    );
    ordered.turn_position=index+1;
  }

  await client.query(
    "UPDATE game_rooms SET status='playing',started_at=NOW(),phase='cards',current_player_id=$2,turn_number=1,reinforcements_remaining=0,conquered_this_turn=FALSE WHERE id=$1",
    [room.id,order[0].id],
  );

  room.status="playing";
  room.phase="cards";
  room.current_player_id=order[0].id;
  room.turn_number=1;
  room.reinforcements_remaining=0;
  room.conquered_this_turn=false;
}

async function snapshot(client:PoolClient, room:Room, session:string):Promise<GameSnapshot> {
  const players=(await client.query<Player>("SELECT id,faction_name,color,turn_position,player_session=$2 is_me FROM room_players WHERE room_id=$1 ORDER BY turn_position NULLS LAST,joined_at",[room.id,session])).rows; const me=players.find(player=>player.is_me); if(!me) throw new RoomError("Você não pertence a esta partida.",403);
  const [territories,rolls,cards,objectives,connections]=await Promise.all([
    client.query<Territory>("SELECT t.territory_id,t.owner_player_id,p.color,t.troops,t.moved_in_turn FROM game_territories t JOIN room_players p ON p.id=t.owner_player_id WHERE t.room_id=$1 ORDER BY t.territory_id",[room.id]),
    client.query<Roll>("SELECT player_id,roll_round,value,rolled_at FROM game_order_rolls WHERE room_id=$1 ORDER BY roll_round,rolled_at",[room.id]),
    client.query<Card>("SELECT id,territory_id,symbol,is_wild FROM game_cards WHERE room_id=$1 AND owner_player_id=$2 AND zone='hand' ORDER BY id",[room.id,me.id]),
    client.query<Objective>("SELECT o.id,o.type,o.name,o.description,o.params,a.target_player_id,t.faction_name target_name FROM game_player_objectives a JOIN objectives o ON o.id=a.objective_id LEFT JOIN room_players t ON t.id=a.target_player_id WHERE a.room_id=$1 AND a.player_id=$2",[room.id,me.id]),
    client.query<{territory_a:number;territory_b:number;is_passable:boolean;barrier_name:string|null;description:string|null}>("SELECT territory_a,territory_b,is_passable,barrier_name,description FROM territory_connections ORDER BY territory_a,territory_b"),
  ]);
  const byPlayer=new Map<string,Array<{round:number;value:number}>>(); for(const roll of rolls.rows) byPlayer.set(roll.player_id,[...(byPlayer.get(roll.player_id)??[]),{round:roll.roll_round,value:roll.value}]); const objective=objectives.rows[0];
  const eligiblePlayerIds=room.status==="order_roll"?eligible(players,rolls.rows,room.order_roll_round):[];
  const orderRollPlayerId=eligiblePlayerIds.find(playerId=>!rolls.rows.some(roll=>roll.player_id===playerId&&roll.roll_round===room.order_roll_round))??null;
  const lastOrderRollPlayerId=rolls.rows.filter(roll=>roll.roll_round===room.order_roll_round).at(-1)?.player_id??null;
  return { room:{id:room.id,code:room.code,status:room.status,orderRollRound:room.order_roll_round,orderRollPlayerId,lastOrderRollPlayerId,phase:room.phase,currentPlayerId:room.current_player_id,turnNumber:room.turn_number,reinforcementsRemaining:room.reinforcements_remaining,winnerPlayerId:room.winner_player_id,pendingConquest:room.pending_from_territory_id&&room.pending_to_territory_id?{fromTerritoryId:room.pending_from_territory_id,toTerritoryId:room.pending_to_territory_id}:null,battle:isBattle(room.last_battle)?room.last_battle:null}, players:players.map(player=>({id:player.id,factionName:player.faction_name,color:player.color,turnPosition:player.turn_position,isMe:Boolean(player.is_me),rolls:byPlayer.get(player.id)??[]})), territories:territories.rows.map(territory=>({territoryId:territory.territory_id,ownerPlayerId:territory.owner_player_id,ownerColor:territory.color,troops:territory.troops,movedInTurn:territory.moved_in_turn})), eligiblePlayerIds, connections:connections.rows.map(connection=>({territoryA:connection.territory_a,territoryB:connection.territory_b,exists:true,passable:connection.is_passable,barrierName:connection.barrier_name,description:connection.description})), myCards:cards.rows.map(card=>({id:card.id,territoryId:card.territory_id,symbol:card.is_wild?"wild":card.symbol!})), myObjective:objective?{id:objective.id,name:objective.name,description:objective.description,targetFactionName:objective.target_name}:null };
}
export async function getGameSnapshot(value:string, session:string) { const id=roomId(value); return transaction(async client=>{ const room=await lockedRoom(client,id); if(!(["order_roll","playing","finished"] as string[]).includes(room.status)) throw new RoomError("Partida não encontrada.",404); await advanceOrderRollPresentation(client,room); await advanceBattlePresentation(client,room); return snapshot(client,room,session); }); }

export async function rollOrderDie(value:string,session:string) {
  const id=roomId(value);

  return transaction(async client=>{
    const room=await lockedRoom(client,id);

    if(room.status!=="order_roll") {
      throw new RoomError("O sorteio de ordem não está disponível.",409);
    }

    const player=await playerFor(client,room,session);

    const players=(await client.query<Player>(
      "SELECT id,faction_name,color,turn_position FROM room_players WHERE room_id=$1 ORDER BY joined_at",
      [room.id],
    )).rows;

    const rolls=(await client.query<Roll>(
      "SELECT player_id,roll_round,value,rolled_at FROM game_order_rolls WHERE room_id=$1 ORDER BY roll_round,rolled_at",
      [room.id],
    )).rows;

    const current=eligible(players,rolls,room.order_roll_round);

    const nextPlayerId=current.find(
      playerId=>!rolls.some(
        roll=>roll.player_id===playerId&&roll.roll_round===room.order_roll_round,
      ),
    );

    if(player.id!==nextPlayerId) {
      throw new RoomError(
        "Aguarde sua vez de rolar o dado.",
        409,
        {nextPlayerId,requestPlayerId:player.id},
      );
    }

    const die=randomInt(1,7);

    await client.query(
      "INSERT INTO game_order_rolls(room_id,player_id,roll_round,value) VALUES($1,$2,$3,$4)",
      [room.id,player.id,room.order_roll_round,die],
    );

    return {value:die};
  });
}

async function beginReinforcement(client:PoolClient,room:Room,player:Player) { const owned=(await client.query<{territory_id:number}>("SELECT territory_id FROM game_territories WHERE room_id=$1 AND owner_player_id=$2",[room.id,player.id])).rows; await client.query("UPDATE game_rooms SET phase='reinforcement',reinforcements_remaining=$2 WHERE id=$1",[room.id,reinforcementFor(owned.map(territory=>territory.territory_id))]); }
export async function advancePhase(value:string,session:string,input:Record<string,unknown>) { const id=roomId(value); return transaction(async client=>{ const room=await lockedRoom(client,id); const player=await playerFor(client,room,session); await advanceBattlePresentation(client,room); if(input.action==="finishCards") { assertTurn(room,player,"cards"); return beginReinforcement(client,room,player); } if(input.action==="finishAttack") { assertTurn(room,player,"attack"); if(isBattle(room.last_battle)||room.pending_from_territory_id) throw new RoomError("Conclua a batalha atual antes de encerrar os ataques.",409); await client.query("UPDATE game_rooms SET phase='maneuver' WHERE id=$1",[room.id]); return; } if(input.action!=="endTurn") throw new RoomError("Ação de fase inválida.",422); assertTurn(room,player,"maneuver"); if(room.conquered_this_turn) await drawCard(client,room,player.id); const next=(await client.query<{id:string}>(`SELECT p.id FROM room_players p WHERE p.room_id=$1 AND p.turn_position>(SELECT turn_position FROM room_players WHERE id=$2) AND EXISTS(SELECT 1 FROM game_territories WHERE room_id=$1 AND owner_player_id=p.id) ORDER BY p.turn_position LIMIT 1`,[room.id,player.id])).rows[0]??(await client.query<{id:string}>("SELECT p.id FROM room_players p WHERE p.room_id=$1 AND EXISTS(SELECT 1 FROM game_territories WHERE room_id=$1 AND owner_player_id=p.id) ORDER BY p.turn_position LIMIT 1",[room.id])).rows[0]; await client.query("UPDATE game_territories SET moved_in_turn=0 WHERE room_id=$1",[room.id]); await client.query("UPDATE game_rooms SET phase='cards',current_player_id=$2,turn_number=turn_number+1,reinforcements_remaining=0,conquered_this_turn=FALSE WHERE id=$1",[room.id,next.id]); }); }

export async function reinforce(value:string,session:string,input:Record<string,unknown>) { const id=roomId(value), territory=integer(input.territoryId,"Território inválido."), troops=integer(input.troops,"Quantidade de tropas inválida."); return transaction(async client=>{ const room=await lockedRoom(client,id),player=await playerFor(client,room,session); assertTurn(room,player,"reinforcement"); if(troops>room.reinforcements_remaining) throw new RoomError("Você não possui reforços suficientes.",409); const own=await client.query("SELECT 1 FROM game_territories WHERE room_id=$1 AND territory_id=$2 AND owner_player_id=$3 FOR UPDATE",[room.id,territory,player.id]); if(!own.rowCount) throw new RoomError("Você só pode reforçar territórios próprios.",409); const remaining=room.reinforcements_remaining-troops; await client.query("UPDATE game_territories SET troops=troops+$3 WHERE room_id=$1 AND territory_id=$2",[room.id,territory,troops]); await client.query("UPDATE game_rooms SET reinforcements_remaining=$2,phase=CASE WHEN $2=0 THEN 'attack' ELSE phase END WHERE id=$1",[room.id,remaining]); await objectiveWon(client,room,player.id); }); }
export async function tradeCards(value:string,session:string,input:Record<string,unknown>) { const id=roomId(value), ids=Array.isArray(input.cardIds)?input.cardIds.filter((card):card is string=>typeof card==="string"):[]; if(ids.length!==3||new Set(ids).size!==3) throw new RoomError("Selecione exatamente três cartas diferentes.",422); return transaction(async client=>{ const room=await lockedRoom(client,id),player=await playerFor(client,room,session); if(room.status!=="playing"||room.current_player_id!==player.id||!["cards","reinforcement"].includes(room.phase)) throw new RoomError("A troca não está disponível neste momento.",409); const cards=await client.query<Card>("SELECT id,territory_id,symbol,is_wild FROM game_cards WHERE room_id=$1 AND owner_player_id=$2 AND zone='hand' AND id=ANY($3::bigint[]) FOR UPDATE",[room.id,player.id,ids]); if(cards.rowCount!==3) throw new RoomError("Uma das cartas selecionadas não está na sua mão.",409); if(!isValidTrade(cards.rows.map(card=>card.is_wild?"wild":card.symbol!) as Array<CardSymbol|"wild">)) throw new RoomError("Esta combinação de cartas não é válida.",422); const owned=new Set((await client.query<{territory_id:number}>("SELECT territory_id FROM game_territories WHERE room_id=$1 AND owner_player_id=$2",[room.id,player.id])).rows.map(row=>row.territory_id)); await client.query("UPDATE game_cards SET zone='discard',owner_player_id=NULL,deck_order=NULL WHERE id=ANY($1::bigint[])",[ids]); for(const card of cards.rows) if(card.territory_id&&owned.has(card.territory_id)) await client.query("UPDATE game_territories SET troops=troops+2 WHERE room_id=$1 AND territory_id=$2",[room.id,card.territory_id]); await client.query("UPDATE game_rooms SET reinforcements_remaining=reinforcements_remaining+$2,trade_count=trade_count+1 WHERE id=$1",[room.id,tradeValue(room.trade_count)]); await objectiveWon(client,room,player.id); }); }

export async function attack(value:string,session:string,input:Record<string,unknown>) {
  const id=roomId(value), from=integer(input.fromTerritoryId,"Território atacante inválido."), to=integer(input.toTerritoryId,"Território defensor inválido.");
  return transaction(async client=>{
    const room=await lockedRoom(client,id), player=await playerFor(client,room,session); assertTurn(room,player,"attack");
    await advanceBattlePresentation(client,room);
    if(isBattle(room.last_battle)) throw new RoomError("Aguarde a resolução do combate atual.",409,{stage:room.last_battle.stage});
    if(room.pending_from_territory_id) throw new RoomError("Conclua o deslocamento da conquista antes de atacar novamente.",409,{pendingFromTerritoryId:room.pending_from_territory_id,pendingToTerritoryId:room.pending_to_territory_id});
    const connection=await getTerritoryConnection(client,from,to);
    if(!connection.exists) throw new RoomError("Os territórios não possuem fronteira militar.",422,{fromTerritoryId:from,toTerritoryId:to,connection});
    if(!connection.passable) throw new RoomError(connection.barrierName ? `Fronteira bloqueada — ${connection.barrierName}` : "Fronteira militar bloqueada.",422,{fromTerritoryId:from,toTerritoryId:to,connection});
    const rows=(await client.query<LockedTerritory>("SELECT territory_id,owner_player_id,troops,moved_in_turn FROM game_territories WHERE room_id=$1 AND territory_id=ANY($2::smallint[]) FOR UPDATE",[room.id,[from,to]])).rows;
    const attacker=rows.find(row=>row.territory_id===from), defender=rows.find(row=>row.territory_id===to);
    if(!attacker||!defender||attacker.owner_player_id!==player.id||defender.owner_player_id===player.id||attacker.troops<2) throw new RoomError("Ataque inválido.",409,{fromTerritoryId:from,toTerritoryId:to,requestPlayerId:player.id,attacker:attacker?{ownerPlayerId:attacker.owner_player_id,troops:attacker.troops}:null,defender:defender?{ownerPlayerId:defender.owner_player_id,troops:defender.troops}:null});
    const battle:Battle={attackerTerritoryId:from,defenderTerritoryId:to,attackerPlayerId:player.id,defenderPlayerId:defender.owner_player_id,stage:"awaiting_attacker_roll",stageStartedAt:new Date().toISOString(),attacker:[],defender:[],attackerLosses:0,defenderLosses:0,conquered:false};
    await saveBattle(client,room,battle);
    return battle;
  });
}

export async function rollBattleDice(value: string, session: string) {
  const id = roomId(value);

  return transaction(async (client) => {
    const room = await lockedRoom(client, id);
    const player = await playerFor(client, room, session);

    if (room.status !== "playing" || room.phase !== "attack") {
      throw new RoomError(
        "Os dados de combate não estão disponíveis neste momento.",
        409,
        {
          roomStatus: room.status,
          roomPhase: room.phase,
          requestPlayerId: player.id,
        },
      );
    }

    await advanceBattlePresentation(client, room);

    const battle = room.last_battle;
    if(!isBattle(battle)) throw new RoomError("Não há combate aguardando dados.",409); const rows=(await client.query<LockedTerritory>("SELECT territory_id,owner_player_id,troops,moved_in_turn FROM game_territories WHERE room_id=$1 AND territory_id=ANY($2::smallint[]) FOR UPDATE",[room.id,[battle.attackerTerritoryId,battle.defenderTerritoryId]])).rows; const attacker=rows.find(row=>row.territory_id===battle.attackerTerritoryId),defender=rows.find(row=>row.territory_id===battle.defenderTerritoryId); if(!attacker||!defender) throw new RoomError("Os territórios do combate não foram encontrados.",409); if(battle.stage==="awaiting_attacker_roll") { if(player.id!==battle.attackerPlayerId) throw new RoomError("Apenas o atacante pode rolar agora.",403); battle.attacker=Array.from({length:Math.min(3,attacker.troops-1)},()=>randomInt(1,7)).sort((a,b)=>b-a); battle.stage="show_attacker_result"; battle.stageStartedAt=new Date().toISOString(); await saveBattle(client,room,battle); return battle; } if(battle.stage==="awaiting_defender_roll") { if(player.id!==battle.defenderPlayerId) throw new RoomError("Apenas o defensor pode rolar agora.",403); battle.defender=Array.from({length:Math.min(3,defender.troops)},()=>randomInt(1,7)).sort((a,b)=>b-a); const resolved=resolveBattle(battle.attacker,battle.defender); battle.attacker=resolved.attacker; battle.defender=resolved.defender; battle.attackerLosses=resolved.attackerLosses; battle.defenderLosses=resolved.defenderLosses; battle.conquered=resolved.defenderLosses===defender.troops; battle.stage="show_defender_result"; battle.stageStartedAt=new Date().toISOString(); await saveBattle(client,room,battle); return battle; } throw new RoomError("Aguarde a próxima etapa visual do combate.",409,{stage:battle.stage}); }); }

export async function completeConquest(value:string,session:string,input:Record<string,unknown>) {
  const id=roomId(value), troops=integer(input.troops,"Quantidade de tropas inválida.");
  return transaction(async client=>{
    const room=await lockedRoom(client,id), player=await playerFor(client,room,session); assertTurn(room,player,"attack");
    const from=room.pending_from_territory_id, to=room.pending_to_territory_id; if(!from||!to||!isBattle(room.last_battle)||room.last_battle.stage!=="show_battle_result") throw new RoomError("Não há conquista pendente.",409);
    const rows=(await client.query<LockedTerritory>("SELECT territory_id,owner_player_id,troops,moved_in_turn FROM game_territories WHERE room_id=$1 AND territory_id=ANY($2::smallint[]) FOR UPDATE",[room.id,[from,to]])).rows;
    const source=rows.find(row=>row.territory_id===from), target=rows.find(row=>row.territory_id===to);
    if(!source||!target||source.owner_player_id!==player.id||target.owner_player_id!==player.id||troops>source.troops-1) throw new RoomError("Deslocamento de conquista inválido.",409);
    await client.query("UPDATE game_territories SET troops=troops-$3 WHERE room_id=$1 AND territory_id=$2",[room.id,from,troops]);
    await client.query("UPDATE game_territories SET troops=$3,moved_in_turn=$3 WHERE room_id=$1 AND territory_id=$2",[room.id,to,troops]);
    await client.query("UPDATE game_rooms SET pending_from_territory_id=NULL,pending_to_territory_id=NULL WHERE id=$1",[room.id]);
    room.pending_from_territory_id=null; room.pending_to_territory_id=null;
    await saveBattle(client,room,null);
    await objectiveWon(client,room,player.id);
  });
}
export async function maneuver(value:string,session:string,input:Record<string,unknown>) { const id=roomId(value),from=integer(input.fromTerritoryId,"Território de origem inválido."),to=integer(input.toTerritoryId,"Território de destino inválido."),troops=integer(input.troops,"Quantidade de tropas inválida."); return transaction(async client=>{ const room=await lockedRoom(client,id),player=await playerFor(client,room,session); assertTurn(room,player,"maneuver"); const connection=await getTerritoryConnection(client,from,to); if(!connection.exists) throw new RoomError("Os territórios não possuem fronteira militar.",422,{fromTerritoryId:from,toTerritoryId:to,connection}); if(!connection.passable) throw new RoomError(connection.barrierName ? `Fronteira bloqueada — ${connection.barrierName}` : "Fronteira militar bloqueada.",422,{fromTerritoryId:from,toTerritoryId:to,connection}); const rows=(await client.query<LockedTerritory>("SELECT territory_id,owner_player_id,troops,moved_in_turn FROM game_territories WHERE room_id=$1 AND territory_id=ANY($2::smallint[]) FOR UPDATE",[room.id,[from,to]])).rows,source=rows.find(row=>row.territory_id===from),destination=rows.find(row=>row.territory_id===to); if(!source||!destination||source.owner_player_id!==player.id||destination.owner_player_id!==player.id) throw new RoomError("Você só pode deslocar entre territórios próprios.",409,{fromTerritoryId:from,toTerritoryId:to,requestPlayerId:player.id,source:source?{ownerPlayerId:source.owner_player_id,troops:source.troops,movedInTurn:source.moved_in_turn}:null,destination:destination?{ownerPlayerId:destination.owner_player_id,troops:destination.troops,movedInTurn:destination.moved_in_turn}:null}); if(troops>source.troops-source.moved_in_turn-1) throw new RoomError("Estas tropas já foram deslocadas ou o território ficaria vazio.",409,{fromTerritoryId:from,toTerritoryId:to,requestedTroops:troops,sourceTroops:source.troops,movedInTurn:source.moved_in_turn}); await client.query("UPDATE game_territories SET troops=troops-$3 WHERE room_id=$1 AND territory_id=$2",[room.id,from,troops]); await client.query("UPDATE game_territories SET troops=troops+$3,moved_in_turn=moved_in_turn+$3 WHERE room_id=$1 AND territory_id=$2",[room.id,to,troops]); }); }
async function drawCard(client:PoolClient,room:Room,player:string) { let card=await client.query<{id:string}>("SELECT id FROM game_cards WHERE room_id=$1 AND zone='deck' ORDER BY deck_order FOR UPDATE LIMIT 1",[room.id]); if(!card.rowCount) { const discard=(await client.query<{id:string}>("SELECT id FROM game_cards WHERE room_id=$1 AND zone='discard' FOR UPDATE",[room.id])).rows; const order=discard.map((_,index)=>index+1); for(let i=order.length-1;i>0;i-=1){const j=randomInt(0,i+1);[order[i],order[j]]=[order[j],order[i]];} for(const [index,item] of discard.entries()) await client.query("UPDATE game_cards SET zone='deck',deck_order=$2 WHERE id=$1",[item.id,order[index]]); card=await client.query<{id:string}>("SELECT id FROM game_cards WHERE room_id=$1 AND zone='deck' ORDER BY deck_order FOR UPDATE LIMIT 1",[room.id]); } if(card.rowCount) await client.query("UPDATE game_cards SET zone='hand',owner_player_id=$2,deck_order=NULL WHERE id=$1",[card.rows[0].id,player]); }

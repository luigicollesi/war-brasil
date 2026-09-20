# Modos de Jogo Objetivo e Supremacia V1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar, em salas personalizadas, os rulesets `objective` e `supremacy` e o toggle autoritativo `Sorte balanceada`, preservando o comportamento atual como default e integrando configuração, snapshots, vitória, bots, rematch e UI.

**Architecture:** PostgreSQL continua sendo a única autoridade. `game.rooms` guarda a configuração editável da sala enquanto `waiting`; `game.matches` congela ruleset, flag de balanceamento e perfil efetivo quando a partida começa. Um dispatcher único de vitória seleciona a política de Objetivo ou Supremacia, enquanto o lobby continua convergindo por snapshot HTTP autoritativo e o jogo continua usando o boundary transacional/revisionado vigente.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, PostgreSQL/`pg`, Node test runner, CSS Modules, runtime realtime/worker existente.

**Spec:** `docs/game-modes/SPEC.md`

**Eval:** `docs/game-modes/EVAL.md`

## Global Constraints

- Existem exatamente dois rulesets nesta V1: `objective` e `supremacy`.
- `match_mode` continua significando `classic | custom` e MUST NOT ser reutilizado como ruleset.
- Defaults: `ruleset='objective'` e `balanced_dice_enabled=TRUE`.
- PostgreSQL é a única fonte de verdade para configuração, match snapshot, vencedor e estado terminal.
- Settings só podem mudar em `room.status='waiting'` e somente pelo host/primeiro humano da sala.
- Alteração efetiva de settings e reset de ready humano devem ocorrer na mesma transação.
- O start e a mutação de settings devem serializar pelo mesmo lock autoritativo da sala.
- Supremacia MUST NOT criar `game.player_objectives` sintéticos.
- Vitória de Supremacia usa a quantidade real de territórios persistidos e exige `total > 0`.
- `balanced_dice_enabled=false` usa perfil uniforme; o browser nunca escolhe pesos, probabilidades ou profile id.
- Rematch preserva os settings da sala e cria novos snapshots por match.
- Nenhuma dependência nova deve ser adicionada.
- Não iniciar `npm run dev`, `next dev`, worker/realtime em modo persistente ou qualquer servidor durante a implementação.
- Antes de confiar no CPG, executar `npm run context:cpg:status`; se estiver `CURRENT`, consultar apenas os símbolos afetados. Se estiver `STALE`/`MISSING`, usar o source como verdade e não bloquear a implementação.
- A migration planejada é `043-game-modes-objective-supremacy.sql` porque `042-territory-skins-v1.sql` é a maior migration no branch de origem. Se `dev` ganhar outra `043` antes do merge/rebase, renumerar esta migration para o próximo número livre antes de integrar.

---

## File Structure

### Novos arquivos

- `src/lib/shared/game-mode.ts` — contrato compartilhado de ruleset e helper puro de progresso territorial.
- `src/app/api/rooms/[code]/settings/route.ts` — adapter HTTP de configuração da sala.
- `src/components/lobby-room-settings.tsx` — controle compacto Objetivo/Supremacia + Sorte balanceada.
- `src/components/lobby-room-settings.module.css` — popover desktop/bottom-sheet mobile e estados acessíveis.
- `src/lib/server/game-victory-service.ts` — dispatcher central de vitória e finalização comum.
- `src/lib/server/game-supremacy-service.ts` — política autoritativa isolada de domínio total.
- `src/lib/db/migrations/managed/043-game-modes-objective-supremacy.sql` — persistência da sala e snapshots do match.
- `tests/game-mode-contract.test.mjs` — contrato compartilhado e invariantes estruturais.
- `tests/lobby-room-settings.test.mjs` — contrato/UI/acessibilidade de settings.
- `tests/game-supremacy-rules.test.mjs` — política/dispatcher e regressões de chamadas.
- `tests/integration/game-mode-migration.test.mjs` — defaults, constraints e imutabilidade de snapshots.
- `tests/integration/room-settings.test.mjs` — autorização, ready reset, no-op e concorrência settings/start.
- `tests/integration/game-mode-start.test.mjs` — inicialização Objective/Supremacia e perfil de dados.
- `tests/integration/game-mode-victory.test.mjs` — 41/42, 42/42, eliminação e estado terminal.
- `tests/integration/game-mode-lifecycle.test.mjs` — rematch, return-to-lobby e histórico de matches.

### Arquivos principais modificados

- `src/lib/db/schema.sql`
- `src/lib/shared/lobby.ts`
- `src/lib/shared/game-contract.ts`
- `src/lib/shared/game-snapshot-sharing.ts`
- `src/lib/shared/bots/bot-state.ts`
- `src/lib/shared/bots/bot-objective-plan.ts`
- `src/lib/server/rooms.ts`
- `src/lib/server/start-game-service.ts`
- `src/lib/server/game-dice-balance-service.ts`
- `src/lib/server/game-objective-service.ts`
- `src/lib/server/game-battle-service.ts`
- `src/lib/server/game-troop-command-service.ts`
- `src/lib/server/game-conquest-command-service.ts`
- `src/lib/server/game-command-service.ts`
- `src/lib/server/game-maneuver-command-service.ts`
- `src/lib/server/game-snapshot-service.ts`
- `src/lib/server/bots/bot-state-service.ts`
- `src/components/lobby-client.tsx`
- `src/components/lobby-command-workspace.tsx`
- `src/components/lobby-command-workspace.module.css`
- `src/components/game-turn-panel.tsx`
- `scripts/e2e/lobby-e2e.mjs`
- testes existentes de objetivos, bots, vitória e dados adaptativos quando precisarem de fixtures com `ruleset`.

---

### Task 1: Introduzir o contrato de ruleset e persistência compatível

**Files:**
- Create: `src/lib/shared/game-mode.ts`
- Create: `src/lib/db/migrations/managed/043-game-modes-objective-supremacy.sql`
- Modify: `src/lib/db/schema.sql`
- Create: `tests/game-mode-contract.test.mjs`
- Create: `tests/integration/game-mode-migration.test.mjs`
- Modify: `tests/integration/database-migration.test.mjs`

**Interfaces:**
- Produces: `GAME_RULESETS`, `GameRuleset`, `isGameRuleset(value)`, `territoryControlProgress(territories, playerId)`.
- Produces DB columns: `game.rooms.ruleset`, `game.rooms.balanced_dice_enabled`, `game.matches.ruleset_snapshot`, `game.matches.balanced_dice_enabled_snapshot`.
- Preserves: `game.rooms.match_mode` and `game.matches.match_mode_snapshot` with their existing semantics.

- [ ] **Step 1: Revalidar o contexto técnico antes de editar**

Run:

```bash
npm run context:cpg:status
```

If `CURRENT`, run only:

```bash
npm run context:cpg:symbol -- startGame
npm run context:cpg:callers -- objectiveWon
npm run context:cpg:symbol -- initializeDiceBalanceForGame
npm run context:cpg:symbol -- getLobbySnapshot
```

If not current, continue from the source files listed in this plan; do not infer graph relationships.

- [ ] **Step 2: Escrever o teste de contrato compartilhado primeiro**

Add assertions equivalent to:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  GAME_RULESETS,
  isGameRuleset,
  territoryControlProgress,
} from "../.test-build/game-mode.js";

test("game modes expõem somente objective e supremacy", () => {
  assert.deepEqual(GAME_RULESETS, ["objective", "supremacy"]);
  assert.equal(isGameRuleset("objective"), true);
  assert.equal(isGameRuleset("supremacy"), true);
  assert.equal(isGameRuleset("classic"), false);
});

test("progresso territorial usa o total real recebido", () => {
  const territories = [
    { ownerPlayerId: "10" },
    { ownerPlayerId: "10" },
    { ownerPlayerId: "20" },
  ];
  assert.deepEqual(territoryControlProgress(territories, "10"), {
    owned: 2,
    total: 3,
    ratio: 2 / 3,
  });
});
```

Run:

```bash
npm run test:compile && node --test tests/game-mode-contract.test.mjs
```

Expected: FAIL because `game-mode.ts` does not exist yet.

- [ ] **Step 3: Implementar o contrato compartilhado mínimo**

Create:

```ts
export const GAME_RULESETS = ["objective", "supremacy"] as const;
export type GameRuleset = (typeof GAME_RULESETS)[number];

export function isGameRuleset(value: unknown): value is GameRuleset {
  return GAME_RULESETS.some((ruleset) => ruleset === value);
}

export function territoryControlProgress(
  territories: readonly { ownerPlayerId: string }[],
  playerId: string,
) {
  const total = territories.length;
  const owned = territories.filter(
    (territory) => territory.ownerPlayerId === playerId,
  ).length;
  return { owned, total, ratio: total > 0 ? owned / total : 0 };
}
```

- [ ] **Step 4: Escrever o teste de migration antes da migration**

The DB test must prove:

```text
INSERT game.rooms(code) -> ruleset='objective', balanced_dice_enabled=true
invalid room ruleset -> constraint failure
legacy insert without new columns -> success
new match snapshots accept objective/supremacy and boolean
invalid match ruleset snapshot -> constraint failure
snapshot columns cannot be updated after match creation
```

Run:

```bash
node --test tests/integration/game-mode-migration.test.mjs
```

Expected: FAIL because the new columns do not exist.

- [ ] **Step 5: Criar migration 043 e alinhar clean-install schema**

Migration shape:

```sql
-- Up Migration

ALTER TABLE game.rooms
  ADD COLUMN IF NOT EXISTS ruleset TEXT NOT NULL DEFAULT 'objective',
  ADD COLUMN IF NOT EXISTS balanced_dice_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE game.rooms
  ADD CONSTRAINT rooms_ruleset_check
  CHECK (ruleset IN ('objective', 'supremacy'));

ALTER TABLE game.matches
  ADD COLUMN IF NOT EXISTS ruleset_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS balanced_dice_enabled_snapshot BOOLEAN;

ALTER TABLE game.matches
  ADD CONSTRAINT matches_ruleset_snapshot_check
  CHECK (ruleset_snapshot IS NULL OR ruleset_snapshot IN ('objective', 'supremacy'));
```

Use guarded `DO $$ ... IF NOT EXISTS ... $$` for named constraints, following managed migration conventions.

Add a dedicated immutable trigger for:

```text
match_mode_snapshot
ruleset_snapshot
balanced_dice_enabled_snapshot
```

Do not rewrite migration `036`.

While touching the same clean-install tables, align `src/lib/db/schema.sql` with already-existing managed history relevant to these fields: include `game.rooms.match_mode`, `game.rooms.finished_at` and `game.matches.match_mode_snapshot` as well as the new mode columns, rather than leaving the clean schema behind migrations `032/036`.

- [ ] **Step 6: Rodar os testes focados e compilar**

```bash
npm run test:compile
node --test tests/game-mode-contract.test.mjs
node --test tests/integration/game-mode-migration.test.mjs
node --test tests/integration/database-migration.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/game-mode.ts src/lib/db/schema.sql src/lib/db/migrations/managed/043-game-modes-objective-supremacy.sql tests/game-mode-contract.test.mjs tests/integration/game-mode-migration.test.mjs tests/integration/database-migration.test.mjs
git commit -m "feat: add game mode persistence contract"
```

**EVAL closed:** MODE-DOM-01..08, foundation for MODE-START-02..04 and historical immutability.

---

### Task 2: Adicionar configuração autoritativa da sala e endpoint próprio

**Files:**
- Modify: `src/lib/shared/lobby.ts`
- Modify: `src/lib/server/rooms.ts`
- Create: `src/app/api/rooms/[code]/settings/route.ts`
- Create: `tests/integration/room-settings.test.mjs`
- Create/Modify: source-contract test for route boundary as needed in `tests/lobby-room-settings.test.mjs`

**Interfaces:**
- Consumes: `GameRuleset`, `isGameRuleset`.
- Produces: `LobbySnapshot.room.ruleset`, `LobbySnapshot.room.balancedDiceEnabled`, `LobbySnapshot.canManageRoom`.
- Produces server API: `updateRoomSettings(codeValue, playerSession, input)`.
- HTTP: `PATCH /api/rooms/:code/settings` with only `ruleset` and/or `balancedDiceEnabled`.

- [ ] **Step 1: Escrever testes de autorização/validação antes do serviço**

Cover at minimum:

```text
host changes objective -> supremacy
host toggles balanced dice
non-host receives 403 and state is unchanged
unknown actor receives 403
order_roll/playing reject mutation
unknown ruleset rejects 422
wrong boolean type rejects 422
unknown extra key rejects 400/422
empty patch rejects
same persisted values are a no-op and do not reset ready
real change resets all human ready but leaves bots ready
```

Run:

```bash
node --test tests/integration/room-settings.test.mjs
```

Expected: FAIL because the service/columns contract is not wired.

- [ ] **Step 2: Generalizar a autoridade do primeiro humano sem mudar sua regra atual**

Refactor the existing first-human lookup into a single server helper in `rooms.ts`, e.g.:

```ts
async function assertRoomManager(
  client: PoolClient,
  roomId: string,
  playerSession: string,
) { /* first non-bot ORDER BY joined_at,id */ }
```

Reuse it for bot management and settings. Preserve `canManageBots` for compatibility while adding `canManageRoom`; both derive from the same server-authoritative manager identity.

- [ ] **Step 3: Estender `RoomRow` e o lobby snapshot**

Add fields:

```ts
ruleset: GameRuleset;
balanced_dice_enabled: boolean;
```

Map them as:

```ts
room: {
  ...,
  ruleset: room.ruleset,
  balancedDiceEnabled: room.balanced_dice_enabled,
},
canManageRoom: Boolean(manager?.isMe),
```

Update every room SELECT used by lobby snapshot/locking to select the two columns.

- [ ] **Step 4: Implementar `updateRoomSettings` usando o mesmo `FOR UPDATE` do start**

Validation algorithm:

```ts
const allowed = new Set(["ruleset", "balancedDiceEnabled"]);
for (const key of Object.keys(input)) {
  if (!allowed.has(key)) throw new RoomError("Configuração desconhecida.", 422);
}
if (Object.keys(input).length === 0) throw new RoomError("Nenhuma configuração foi informada.", 400);
```

Inside `withTransaction`:

```text
findRoomForUpdate(code)
-> require waiting
-> assertRoomManager
-> validate/resolve next values
-> if identical: return room without resetting ready
-> UPDATE game.rooms settings
-> resetHumanReadiness(room.id)
-> return updated room
```

Because `updateLobbyPlayer` already locks the same room before final-ready/start, this serialization is the concurrency primitive; do not invent a second lock table.

- [ ] **Step 5: Criar o route handler seguindo o padrão de `/me`**

The route must:

```ts
const session = getPlayerSession(request);
await assertAuthenticatedPlayerSeat(request, session, { roomCode: code });
const body = await readJsonObject(request);
const room = await updateRoomSettings(code, session, body);
return noStoreJson({ room });
```

Use `roomErrorResponse` with operation `update_room_settings`. Never accept user/host/profile/winner ids in this route.

- [ ] **Step 6: Rodar integração focada + compile**

```bash
npm run test:compile
node --test tests/integration/room-settings.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/lobby.ts src/lib/server/rooms.ts src/app/api/rooms/[code]/settings/route.ts tests/integration/room-settings.test.mjs tests/lobby-room-settings.test.mjs
git commit -m "feat: add authoritative room game settings"
```

**EVAL closed:** MODE-CFG-01..14, MODE-LOB-01..03, security portion of MODE-SEC.

---

### Task 3: Integrar o painel minimalista de configuração ao lobby

**Files:**
- Create: `src/components/lobby-room-settings.tsx`
- Create: `src/components/lobby-room-settings.module.css`
- Modify: `src/components/lobby-client.tsx`
- Modify: `src/components/lobby-command-workspace.tsx`
- Modify: `src/components/lobby-command-workspace.module.css`
- Create/Modify: `tests/lobby-room-settings.test.mjs`

**Interfaces:**
- Consumes: `LobbySnapshot.room.ruleset`, `balancedDiceEnabled`, `canManageRoom`.
- Produces callback: `onUpdateSettings(patch: { ruleset?: GameRuleset; balancedDiceEnabled?: boolean })`.
- Local-only state: panel open/closed. No local authoritative copy of room settings.

- [ ] **Step 1: Escrever o teste estrutural/acessível primeiro**

Assert source/DOM contract includes:

```text
aria-label="Configurações da sala"
role="radiogroup" (or equivalent semantic grouping)
Objetivo
Supremacia
role="switch"
aria-checked
read-only summary for every player
controls gated by canManageRoom
prefers-reduced-motion in CSS
```

Run:

```bash
node --test tests/lobby-room-settings.test.mjs
```

Expected: FAIL before the component exists.

- [ ] **Step 2: Adicionar request de settings ao `LobbyClient`**

Extend pending/error types with `settings` and add:

```ts
async function updateRoomSettings(patch: {
  ruleset?: GameRuleset;
  balancedDiceEnabled?: boolean;
}) {
  // PATCH /api/rooms/${code}/settings
  // on success: await refresh()
  // no optimistic authoritative mutation
}
```

The existing 1s polling remains recovery/sync for guests; host refresh happens only after the mutation commits.

- [ ] **Step 3: Implementar `LobbyRoomSettings` como superfície pequena**

Desktop composition:

```text
[gear]
   └─ popover
      MODO
      [ OBJETIVO | SUPREMACIA ]
      SORTE BALANCEADA   [switch]
```

Mobile: media-query changes the same surface to a compact bottom sheet/contained sheet. Keep only presentation state locally.

Do not add explanatory paragraphs, cards per option, blur-heavy glassmorphism or a permanent vertical section.

- [ ] **Step 4: Integrar resumo read-only ao command status**

Render compact text from authoritative snapshot:

```ts
const modeLabel = ruleset === "supremacy" ? "SUPREMACIA" : "OBJETIVO";
const diceLabel = balancedDiceEnabled ? "BALANCEADO" : "ALEATÓRIO";
```

All players see `${modeLabel} · ${diceLabel}`; only `canManageRoom` sees the gear/button and editable panel.

- [ ] **Step 5: Garantir layout/accessibility states**

CSS requirements:

```text
no document-flow vertical section
popover/sheet uses z-index without resizing workspace
focus-visible explicit
switch communicates checked state semantically and visually
transition only opacity/transform
@media (prefers-reduced-motion: reduce) disables transition
mobile panel never requires page scroll to reach its own controls
```

- [ ] **Step 6: Rodar os testes focados e lint nos arquivos alterados**

```bash
npm run test:compile
node --test tests/lobby-room-settings.test.mjs
npx eslint src/components/lobby-client.tsx src/components/lobby-command-workspace.tsx src/components/lobby-room-settings.tsx src/lib/shared/lobby.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/lobby-client.tsx src/components/lobby-command-workspace.tsx src/components/lobby-command-workspace.module.css src/components/lobby-room-settings.tsx src/components/lobby-room-settings.module.css tests/lobby-room-settings.test.mjs
git commit -m "feat: add compact room settings controls"
```

**EVAL closed:** MODE-UX-01..15, client side of MODE-LOB-04..08.

---

### Task 4: Congelar ruleset e política de sorte no match e adaptar o start

**Files:**
- Modify: `src/lib/server/game-dice-balance-service.ts`
- Modify: `src/lib/server/start-game-service.ts`
- Create: `tests/integration/game-mode-start.test.mjs`
- Modify: `tests/adaptive-dice-runtime-contract.test.mjs`
- Modify only if fixtures require: `tests/integration/adaptive-dice-constraints.test.mjs`, `tests/integration/adaptive-dice-locking.test.mjs`

**Interfaces:**
- `initializeDiceBalanceForGame(client, roomId)` returns `{ matchId, profile, ruleset, balancedDiceEnabled }`.
- `resolveProfileForNewMatch(client, balancedDiceEnabled)` chooses existing default resolver when true and `uniform-v1` when false.
- `startGame` assigns objectives only for `ruleset === 'objective'`.

- [ ] **Step 1: Escrever integração dos dois modos e das duas políticas de dados**

Required cases:

```text
objective + balanced=true -> player_objectives exist; match snapshot objective/true; existing default profile resolver used
supremacy + balanced=true -> no player_objectives; territories/cards still created; snapshot supremacy/true
objective + balanced=false -> objective rows exist; resolved profile uniform-v1
supremacy + balanced=false -> no objective rows; resolved profile uniform-v1
invalid/missing uniform-v1 -> safe builtin uniform fallback, effective profile recorded
```

Run:

```bash
node --test tests/integration/game-mode-start.test.mjs
```

Expected: FAIL before the service changes.

- [ ] **Step 2: Estender o room lock dentro do match initializer**

`RoomMatchContext` must select:

```sql
status,current_match_id,match_mode,winner_player_id,ruleset,balanced_dice_enabled
```

Do not accept either value as a function argument from the browser/start caller.

- [ ] **Step 3: Dividir resolução de perfil em balanced e uniform**

Behavior:

```ts
if (room.balanced_dice_enabled) {
  // existing loadDefaultProfileId + loadCatalogProfile path unchanged
} else {
  // explicitly loadCatalogProfile(client, "uniform-v1")
  // on DiceBalanceConfigurationError use SAFE_UNIFORM_DICE_PROFILE
}
```

For the uniform builtin fallback, use `requestedProfileId: null`, `resolvedProfileId: BUILTIN_SAFE_UNIFORM_PROFILE_ID`, `source: "builtin_fallback"` so the FK does not reference a missing catalog row.

- [ ] **Step 4: Congelar settings no mesmo INSERT de `game.matches`**

Extend INSERT columns with:

```text
match_mode_snapshot
ruleset_snapshot
balanced_dice_enabled_snapshot
```

Values must all come from the locked room row. Return the ruleset/balance values from the initializer.

- [ ] **Step 5: Condicionar somente a criação de objetivos no start**

Keep order:

```ts
await capturePlayerCosmeticLoadouts(...);
const match = await initializeDiceBalanceForGame(...);
await createInitialTerritories(...);
if (match.ruleset === "objective") {
  await createObjectives(...);
}
await createDeck(...);
await transitionRoomToOrderRoll(...);
```

Do not fork territory distribution, cards, events or other gameplay initialization.

- [ ] **Step 6: Rodar regressão dos dados e start**

```bash
npm run test:compile
node --test tests/integration/game-mode-start.test.mjs
node --test tests/adaptive-dice-runtime-contract.test.mjs
node --test tests/integration/adaptive-dice-constraints.test.mjs tests/integration/adaptive-dice-locking.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/game-dice-balance-service.ts src/lib/server/start-game-service.ts tests/integration/game-mode-start.test.mjs tests/adaptive-dice-runtime-contract.test.mjs tests/integration/adaptive-dice-constraints.test.mjs tests/integration/adaptive-dice-locking.test.mjs
git commit -m "feat: snapshot ruleset and dice policy per match"
```

**EVAL closed:** MODE-START-01..08, MODE-OBJ-01..02, MODE-SUP-01..04, MODE-DICE-ON-01..05, MODE-DICE-OFF-01..07.

---

### Task 5: Criar o motor unificado de vitória e política de Supremacia

**Files:**
- Create: `src/lib/server/game-supremacy-service.ts`
- Create: `src/lib/server/game-victory-service.ts`
- Modify: `src/lib/server/game-objective-service.ts`
- Modify: `src/lib/server/game-battle-service.ts`
- Modify: `src/lib/server/game-troop-command-service.ts`
- Modify: `src/lib/server/game-conquest-command-service.ts`
- Modify: `src/lib/server/game-command-service.ts`
- Modify: `src/lib/server/game-maneuver-command-service.ts`
- Create: `tests/game-supremacy-rules.test.mjs`
- Create: `tests/integration/game-mode-victory.test.mjs`
- Modify: existing objective/victory regression tests that assert direct `objectiveWon` callsites.

**Interfaces:**
- `objectiveVictorySatisfied(client, roomId, playerId, event): Promise<boolean>` — evaluates only, no terminal mutation.
- `supremacyVictorySatisfied(client, roomId, playerId): Promise<boolean>` — authoritative `owned === total && total > 0`.
- `evaluateGameVictory(client, roomId, playerId, event): Promise<boolean>` — central dispatcher + terminal finalization.
- `loadActiveGameRuleset(client, roomId): Promise<GameRuleset>` — reads current match snapshot when available, persisted room ruleset as guarded fallback.

- [ ] **Step 1: Escrever primeiro os testes de policy**

Unit/source cases:

```text
0 territories -> false
41/42 -> false
42/42 -> true
supremacy ignores troops_changed without querying victory count
objective dispatcher calls existing objective evaluator
no command service retains direct objectiveWon dispatch after migration
```

DB integration terminal case:

```text
A owns total-1
B owns 1
final ownership changes to A
B.turn_position becomes NULL
B hand cards move to A
room.status='finished'
room.phase='finished'
room.winner_player_id=A
pending_from/to are NULL in terminal state
match is finalized
```

Run:

```bash
npm run test:compile
node --test tests/game-supremacy-rules.test.mjs
node --test tests/integration/game-mode-victory.test.mjs
```

Expected: FAIL.

- [ ] **Step 2: Separar avaliação de objetivo da finalização**

Refactor current `objectiveWon` body so all objective-specific calculations remain in `game-objective-service.ts`, but the terminal `UPDATE game.rooms` and `finishDiceBalanceMatchForRoom` move out.

Export:

```ts
export async function objectiveVictorySatisfied(
  client: PoolClient,
  roomId: string,
  playerId: string,
  event: GameVictoryEvent = "any",
): Promise<boolean>
```

Preserve current objective semantics exactly.

- [ ] **Step 3: Implementar policy de Supremacia isolada**

Use one authoritative aggregate:

```sql
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE owner_player_id=$2)::int AS owned
FROM game.territories
WHERE room_id=$1
```

Return only:

```ts
return total > 0 && owned === total;
```

No literal `42` in this policy.

- [ ] **Step 4: Implementar dispatcher e finalização comum**

`evaluateGameVictory` algorithm:

```text
load effective ruleset
if objective -> objectiveVictorySatisfied(event)
if supremacy and event != territory_control_changed -> false immediately
if supremacy -> supremacyVictorySatisfied
if false -> return false
UPDATE room -> status finished, phase finished, winner id, pending conquest NULL
finishDiceBalanceMatchForRoom
return true
```

Keep the mutation inside the caller transaction/command boundary.

- [ ] **Step 5: Substituir os callsites espalhados**

Replace direct objective checks in:

```text
game-battle-service.ts
game-troop-command-service.ts
game-conquest-command-service.ts
game-command-service.ts
game-maneuver-command-service.ts
```

Use the same event names already emitted. The dispatcher itself decides whether Supremacia needs work.

In elimination, after checking the conqueror, only evaluate third-party elimination objectives when the effective ruleset is `objective`. Do not let a third party win in Supremacia.

- [ ] **Step 6: Preservar terminal conquest sem ação extra**

When the final conquest wins, clear `pending_from_territory_id`/`pending_to_territory_id` as part of finalization. It is acceptable to retain `last_battle` for result presentation; the finished snapshot must not require conquest movement.

- [ ] **Step 7: Rodar regressão de objetivos e vitória**

```bash
npm run test:compile
node --test tests/game-supremacy-rules.test.mjs
node --test tests/integration/game-mode-victory.test.mjs
node --test tests/game-victory-flow.test.mjs tests/phase2-rules-adjustments.test.mjs tests/game-elimination-card-rules.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/game-supremacy-service.ts src/lib/server/game-victory-service.ts src/lib/server/game-objective-service.ts src/lib/server/game-battle-service.ts src/lib/server/game-troop-command-service.ts src/lib/server/game-conquest-command-service.ts src/lib/server/game-command-service.ts src/lib/server/game-maneuver-command-service.ts tests/game-supremacy-rules.test.mjs tests/integration/game-mode-victory.test.mjs tests/game-victory-flow.test.mjs tests/phase2-rules-adjustments.test.mjs tests/game-elimination-card-rules.test.mjs
git commit -m "feat: add supremacy victory policy"
```

**EVAL closed:** MODE-WIN-01..07, MODE-SUP-05..15, MODE-ELIM-01..07, MODE-OBJ-03..08.

---

### Task 6: Expor ruleset no game snapshot e apresentar progresso de Supremacia

**Files:**
- Modify: `src/lib/shared/game-contract.ts`
- Modify: `src/lib/server/game-snapshot-service.ts`
- Modify: `src/lib/shared/game-snapshot-sharing.ts`
- Modify: `src/components/game-turn-panel.tsx`
- Modify/Create: focused snapshot/UI tests, preferably `tests/game-mode-snapshot-ui.test.mjs`

**Interfaces:**
- `GameSnapshot.room.ruleset: GameRuleset`.
- `myObjective` remains the existing nullable contract.
- Supremacia progress uses `territoryControlProgress(snapshot.territories, me.id)`.

- [ ] **Step 1: Escrever os testes de snapshot/UI primeiro**

Prove:

```text
objective snapshot contains room.ruleset='objective' and preserves myObjective
supremacy snapshot contains room.ruleset='supremacy' and myObjective=null
supremacy UI renders SUPREMACIA and owned/total
objective UI keeps Objetivo secreto presentation
snapshot sharing invalidates room reference if ruleset changes
```

Run:

```bash
npm run test:compile && node --test tests/game-mode-snapshot-ui.test.mjs
```

Expected: FAIL.

- [ ] **Step 2: Adicionar `ruleset` ao contrato compartilhado**

```ts
room: {
  ...,
  ruleset: GameRuleset;
}
```

Do not make the client consult Profile, Economy or Store to determine ruleset.

- [ ] **Step 3: Adaptar `game-snapshot-service`**

Select `gr.ruleset` with the room. Because room settings are immutable outside `waiting`, this value is identical to the current match snapshot while running and remains stable through `finished`; `game.matches.ruleset_snapshot` remains the historical/audit record.

Load objective conditionally:

```ts
const objective =
  room.ruleset === "objective"
    ? await loadSnapshotObjective(client, room.id, me.id)
    : null;
```

This avoids querying/fabricating an objective in Supremacia.

- [ ] **Step 4: Atualizar structural sharing**

Add `left.ruleset === right.ruleset` to `sameRoom`. No other sharing semantics change.

- [ ] **Step 5: Renderizar leitura compacta no turn panel**

Objective path stays as today.

Supremacy path:

```text
SUPREMACIA
17 / 42 TERRITÓRIOS
```

Compute both values from the snapshot's territory array. Do not add a large permanent panel or leaderboard in V1.

- [ ] **Step 6: Rodar testes e lint focado**

```bash
npm run test:compile
node --test tests/game-mode-snapshot-ui.test.mjs tests/game-regression.test.mjs tests/game-interaction.test.mjs
npx eslint src/lib/shared/game-contract.ts src/lib/shared/game-snapshot-sharing.ts src/lib/server/game-snapshot-service.ts src/components/game-turn-panel.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/game-contract.ts src/lib/server/game-snapshot-service.ts src/lib/shared/game-snapshot-sharing.ts src/components/game-turn-panel.tsx tests/game-mode-snapshot-ui.test.mjs tests/game-regression.test.mjs tests/game-interaction.test.mjs
git commit -m "feat: expose supremacy state in game ui"
```

**EVAL closed:** MODE-GAME-01..08, MODE-SUP-16..17, snapshot side of reconnect.

---

### Task 7: Tornar bots independentes de objetivo em Supremacia

**Files:**
- Modify: `src/lib/shared/bots/bot-state.ts`
- Modify: `src/lib/server/bots/bot-state-service.ts`
- Modify: `src/lib/shared/bots/bot-objective-plan.ts`
- Modify as compiler/tests require only: `src/lib/shared/bots/bot-attack.ts`, `bot-defense.ts`, `bot-reinforcement.ts`, `bot-maneuver.ts`, `bot-territory-value.ts`
- Modify: `tests/bot-objective-strategy.test.mjs`
- Modify/Create: `tests/bot-turn-strategy.test.mjs` or focused supremacy bot test.

**Interfaces:**
- `BotStrategicState.room.ruleset: GameRuleset`.
- `BotStrategicState.objective: BotObjectiveSnapshot | null`.
- `BotObjectivePlan` adds `{ kind: 'supremacy'; territoryCount: number }`.

- [ ] **Step 1: Escrever a falha explícita que reproduz o problema atual**

Add a Supremacia fixture:

```js
const strategicState = state({
  room: { ...state().room, ruleset: "supremacy" },
  objective: null,
  territories: /* bot owns all but one frontier territory */,
});
```

Assert:

```text
buildObjectivePlan does not throw
plan.kind === 'supremacy'
ratio is owned/total
missingTerritories === 1
immediateWinPossible === true
primaryTargets includes the adjacent enemy territory
strategy can choose a legal attack when one exists
```

Run:

```bash
npm run test:compile && node --test tests/bot-objective-strategy.test.mjs tests/bot-turn-strategy.test.mjs
```

Expected: FAIL because objective is currently mandatory.

- [ ] **Step 2: Tornar objective nullable somente onde o ruleset permite**

`loadBotStrategicState` must select room ruleset. Behavior:

```text
objective -> objective row is required; missing row remains an error
supremacy -> do not require game.player_objectives; objective=null
```

This preserves detection of broken Objective matches.

- [ ] **Step 3: Adicionar plano explícito de Supremacia**

Before destructuring `state.objective`:

```ts
if (state.room.ruleset === "supremacy") {
  return { kind: "supremacy", territoryCount: state.territories.length };
}
if (!state.objective) {
  return { kind: "generic_expansion" };
}
```

For progress, reuse territorial count semantics and frontier enemy targets. `immediateWinPossible` is true when exactly one territory is missing.

- [ ] **Step 4: Ajustar consumidores somente se o novo union exigir**

Do not build a second AI. Existing attack/defense/reinforcement machinery should consume the Supremacia plan through its existing generic target/progress fields. Touch downstream files only for exhaustive union branches/compiler errors or a test-proven strategic gap.

- [ ] **Step 5: Rodar a bateria de bots**

```bash
npm run test:compile
node --test tests/bot-objective-strategy.test.mjs tests/bot-turn-strategy.test.mjs tests/bot-combat-strategy.test.mjs tests/bot-strategy-analysis.test.mjs tests/bot-strategy-architecture.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/bots/bot-state.ts src/lib/server/bots/bot-state-service.ts src/lib/shared/bots/bot-objective-plan.ts src/lib/shared/bots/bot-attack.ts src/lib/shared/bots/bot-defense.ts src/lib/shared/bots/bot-reinforcement.ts src/lib/shared/bots/bot-maneuver.ts src/lib/shared/bots/bot-territory-value.ts tests/bot-objective-strategy.test.mjs tests/bot-turn-strategy.test.mjs tests/bot-combat-strategy.test.mjs tests/bot-strategy-analysis.test.mjs tests/bot-strategy-architecture.test.mjs
git commit -m "feat: teach bots supremacy strategy"
```

**EVAL closed:** MODE-BOT-01..07.

---

### Task 8: Cobrir concorrência, rematch, reconnect e histórico imutável

**Files:**
- Create: `tests/integration/game-mode-lifecycle.test.mjs`
- Extend: `tests/integration/room-settings.test.mjs`
- Modify only if test exposes a defect: `src/lib/server/game-finish-command-service.ts`, `src/lib/server/rooms.ts`, `src/lib/server/game-dice-balance-service.ts`

**Interfaces:**
- Rematch keeps `game.rooms.ruleset` and `balanced_dice_enabled` unchanged.
- Each rematch creates a new `game.matches` row with fresh config/profile snapshots.
- Return-to-lobby sets `waiting` but preserves settings.

- [ ] **Step 1: Escrever a corrida settings vs final-ready/start**

Use two independent DB/service actors and a synchronization barrier so requests overlap. Accept only:

```text
A) settings lock wins -> config changes + human ready reset + no match starts
B) final-ready/start lock wins -> match starts with previous full snapshot + settings mutation fails
```

Explicitly reject:

```text
partial new/old snapshot combination
two current matches
settings changed while started match retains new config without matching snapshot
```

- [ ] **Step 2: Escrever lifecycle de rematch**

Scenario:

```text
room supremacy + balanced=false
start match #1
finish
vote rematch
start match #2
assert room settings unchanged
assert match #2 ruleset_snapshot=supremacy
assert match #2 balanced_dice_enabled_snapshot=false
assert match #1 snapshots unchanged
assert match ids/sequences differ
```

- [ ] **Step 3: Escrever retorno ao lobby**

After a finished match:

```text
returnEveryoneToLobby
-> room waiting
-> settings still visible/persisted
-> host can change settings
-> actual change resets human ready
```

The existing `resetRoomToWaiting` UPDATE should simply continue omitting the mode columns; only change production code if the test proves otherwise.

- [ ] **Step 4: Cobrir reconnect por snapshot autoritativo**

At service/integration level, call `getLobbySnapshot` with a fresh client/session after settings are persisted and assert the same values. Do not rely on prior React state.

- [ ] **Step 5: Rodar integração de lifecycle/locking**

```bash
node --test tests/integration/room-settings.test.mjs tests/integration/game-mode-lifecycle.test.mjs tests/integration/game-mode-start.test.mjs tests/integration/game-mode-victory.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/room-settings.test.mjs tests/integration/game-mode-lifecycle.test.mjs src/lib/server/game-finish-command-service.ts src/lib/server/rooms.ts src/lib/server/game-dice-balance-service.ts
git commit -m "test: cover game mode lifecycle and concurrency"
```

**EVAL closed:** MODE-CON-01..05, MODE-REMATCH lifecycle gates, reconnect integration, historical immutability scenarios E/F/G.

---

### Task 9: Fechar E2E do lobby, regressão visual e gates finais do EVAL

**Files:**
- Modify: `scripts/e2e/lobby-e2e.mjs`
- Modify/Create: any existing E2E fixture/helper required by the script, without introducing a new browser framework.
- Modify: `docs/game-modes/EVAL.md` only if the project convention records evidence/status in-place; otherwise leave the authoritative criteria unchanged and report evidence in PR/commit notes.

**Interfaces:**
- No new runtime interface.
- Evidence must cover mandatory scenarios A–G from `EVAL.md` where automatable.

- [ ] **Step 1: Estender o E2E existente em vez de criar infraestrutura paralela**

Automate at minimum:

```text
host sees config button
guest does not see editable config button
host changes Objective -> Supremacy
guest converges to Supremacy summary
human ready states reset
host turns Sorte balanceada off
summary changes to ALEATÓRIO
refresh/reconnect restores both persisted values
```

- [ ] **Step 2: Verificar os quatro viewports definidos pelo EVAL**

Use the existing E2E/browser tooling to validate:

```text
1440x900
1366x768
390x844
390x580
```

Assertions:

```text
no page scroll introduced by settings in normal lobby state
gear does not collide with room code/status
panel controls remain visible
ready remains recoverable/reachable
focus-visible exists
Supremacia/Objetivo label remains legible
```

Do not start a persistent development server manually; use only the finite E2E harness already defined by the repository when its prerequisites are available.

- [ ] **Step 3: Rodar a suíte focada inteira**

```bash
npm run test:compile
node --test tests/game-mode-contract.test.mjs tests/lobby-room-settings.test.mjs tests/game-supremacy-rules.test.mjs tests/game-mode-snapshot-ui.test.mjs
node --test tests/bot-objective-strategy.test.mjs tests/bot-turn-strategy.test.mjs tests/bot-combat-strategy.test.mjs
node --test tests/integration/game-mode-migration.test.mjs tests/integration/room-settings.test.mjs tests/integration/game-mode-start.test.mjs tests/integration/game-mode-victory.test.mjs tests/integration/game-mode-lifecycle.test.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 4: Rodar regressão ampla sem servidor persistente**

```bash
npm run lint
npm test
```

If a database test environment is configured, also run:

```bash
npm run test:db
```

Expected: PASS. If DB/E2E infrastructure is unavailable, report those gates as unverified rather than claiming success.

- [ ] **Step 5: Rodar E2E de lobby se o harness estiver configurado**

```bash
npm run test:e2e:lobby
```

Expected: PASS, including the new settings flow and viewport checks. Never substitute source inspection for a claimed E2E pass.

- [ ] **Step 6: Fazer revisão linha a linha contra o EVAL**

Create a merge checklist from every BLOCKER family:

```text
DOM
CFG
CON
LOB
UX
START
OBJ
SUP
ELIM
WIN
DICE-ON
DICE-OFF
BOT
GAME
REMATCH/RECONNECT/SEC
```

Map each green gate to an actual test/output/source assertion. Any gate without evidence remains open.

- [ ] **Step 7: Commit final de E2E/evidence changes**

```bash
git add scripts/e2e/lobby-e2e.mjs docs/game-modes/EVAL.md
git commit -m "test: close game modes eval coverage"
```

Only include `docs/game-modes/EVAL.md` in this commit if it was actually changed to record evidence; otherwise commit only the E2E files.

---

## Mandatory Acceptance Matrix

| EVAL scenario | Primary task | Required proof |
| --- | --- | --- |
| A. Sala padrão preserva comportamento atual | Tasks 1, 4, 5 | default objective/true, objectives created, adaptive path unchanged, objective victory regression |
| B. Host troca para Supremacia | Tasks 2, 3, 4 | host-only PATCH, ready reset, no player objectives, lobby/game snapshots |
| C. Vitória terminal de Supremacia | Task 5 | ownership final + elimination + finished/finished + winner in same transaction boundary |
| D. Sorte balanceada desligada | Task 4 | false snapshot + `uniform-v1`/safe uniform + no adaptive algorithm |
| E. Concorrência settings vs start | Task 8 | two-transaction race with only two consistent outcomes |
| F. Reconnect multi-client | Tasks 3, 8, 9 | fresh snapshot recovers mode/balance; guest converges |
| G. Rematch | Task 8 | room settings preserved; new independent match snapshots |

## Implementation Notes / Decisions Locked by This Plan

1. **No synthetic objective for Supremacia.** `game.player_objectives` is absent in that mode.
2. **No `match_mode` overload.** `classic/custom` remains an orthogonal concept.
3. **One room lock.** Settings and final-ready/start serialize through the existing `game.rooms ... FOR UPDATE` path.
4. **One match snapshot boundary.** `initializeDiceBalanceForGame` remains the place that creates `game.matches`; it is expanded rather than duplicated.
5. **One victory dispatcher.** Commands call `evaluateGameVictory`; policies stay isolated.
6. **No hardcoded 42 for victory.** Supremacia counts persisted territories; 42 remains valid only for the current map/deck initialization where it already exists.
7. **No second lobby store.** React keeps only panel-open presentation state; values always come back from `useLobbySync` snapshots.
8. **No second bot AI.** Supremacia becomes an explicit plan that reuses existing strategy scoring/target selection.
9. **No rematch special copy step.** Room config persists naturally; each new match re-snapshots it.
10. **No migration-runner branching.** `scripts/prepare-dev-db.mjs` already discovers managed migrations in order; only change it if an implementation test demonstrates a real convergence requirement.

## Completion Gate

Do not declare the feature ready until all of the following are true:

```text
focused TypeScript compile passes
focused unit/source tests pass
all new DB integration tests pass
existing objective regression tests pass
existing adaptive dice regression tests pass
bot regression tests pass
lint passes
npm test passes
E2E/visual gates pass when harness is available
all BLOCKERs in docs/game-modes/EVAL.md have concrete evidence
```

If any required environment is unavailable, leave the corresponding gate explicitly unverified; do not infer success from adjacent tests.
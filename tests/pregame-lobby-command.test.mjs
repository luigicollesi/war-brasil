import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lobby = readFileSync("src/components/lobby-client.tsx", "utf8");
const styles = readFileSync("src/components/lobby-client.module.css", "utf8");
const sync = readFileSync("src/hooks/use-lobby-sync.ts", "utf8");
const rooms = readFileSync("src/lib/server/rooms.ts", "utf8");

test("lobby usa o snapshot vigente como fonte de verdade e assentos estáveis", () => {
  assert.match(lobby, /const \{ snapshot, error: syncError, isLoading, refresh \} = useLobbySync\(code\)/);
  assert.match(lobby, /players\.map\(\(player, index\) =>/);
  assert.match(lobby, /slot=\{index \+ 1\}/);
  assert.match(rooms, /ORDER BY joined_at ASC, id ASC/);
  assert.doesNotMatch(lobby, /setPlayers|setReadyPlayers|setStations|useReducer/);
});

test("ready permanece confirmado pelo servidor e perceptível sem depender de cor", () => {
  assert.match(lobby, /await refresh\(\)/);
  assert.match(lobby, /aria-pressed=\{me\.isReady\}/);
  assert.match(lobby, /player\.isReady \? "✓ Pronto" : "• Configurando"/);
  assert.match(lobby, /data-ready=\{player\.isReady \? "true" : "false"\}/);
  assert.match(styles, /\.station\[data-ready="true"\] \.insignia/);
});

test("código da operação permanece copiável e selecionável", () => {
  assert.match(lobby, /navigator\.clipboard\.writeText\(code\.toUpperCase\(\)\)/);
  assert.match(lobby, /aria-label=\{`Copiar código da sala \$\{roomCode\}`\}/);
  assert.match(styles, /user-select: all/);
});

test("reconexão mantém última formação, anuncia estado e oferece retry", () => {
  assert.match(sync, /setSnapshot\(data as LobbySnapshot\)/);
  assert.match(lobby, /Reconectando ao comando/);
  assert.match(lobby, /última formação confirmada permanece visível/);
  assert.match(lobby, /Sincronizar agora/);
  assert.match(lobby, /aria-live="polite"/);
});

test("briefing representa seis postos e degrada para composição mobile própria", () => {
  assert.match(lobby, /6 - players\.length/);
  for (let slot = 1; slot <= 6; slot += 1) {
    assert.match(styles, new RegExp(`\\.station\\[data-slot="${slot}"\\]`));
  }
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?grid-template-columns: 1fr/);
});

test("fallback HTML não depende de WebGL e respeita reduced motion", () => {
  assert.doesNotMatch(lobby, /three|Canvas|useThree|@react-three/);
  assert.match(lobby, /war-brasil-42\.production\.svg/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /transition: none/);
});

test("autorização de conflito não cria nova espera antes da navegação", () => {
  assert.match(lobby, /snapshot\.room\.status !== "waiting"/);
  assert.match(lobby, /router\.replace\(`\/game\/\$\{snapshot\.room\.id\}`\)/);
  assert.match(lobby, /CONFLITO AUTORIZADO/);
  const navigationEffect = lobby.slice(
    lobby.indexOf("useEffect(() =>"),
    lobby.indexOf("async function updateMe"),
  );
  assert.doesNotMatch(navigationEffect, /setTimeout|setInterval/);
});

test("identidade visual usa autoridade material e reserva vermelho para conflito", () => {
  assert.match(styles, /--lobby-brass:/);
  assert.match(styles, /--lobby-blood:/);
  assert.match(styles, /data-start-authorized="true"/);
  assert.doesNotMatch(styles, /cyan|#00ffff|#00e5ff/i);
});

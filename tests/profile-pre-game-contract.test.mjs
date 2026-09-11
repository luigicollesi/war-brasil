import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("perfil local deixa explícita a origem e não fabrica progressão competitiva", () => {
  const profileData = source("src/lib/profile/profile-data.ts");

  assert.match(profileData, /displayName: "Luigi"/);
  assert.match(profileData, /source: "local-static"/);
  assert.match(profileData, /sourceLabel: "Perfil local temporário"/);
  assert.match(profileData, /isEvaluationFixture: false/);
  assert.match(profileData, /Sistema de progressão ainda não integrado/);
  assert.match(profileData, /Estatísticas ainda não possuem contrato de dados do perfil/);
  assert.match(profileData, /Histórico de partidas ainda não está conectado ao perfil/);
  assert.match(profileData, /Conquistas ainda não possuem sistema de origem/);
  assert.doesNotMatch(profileData, /winRate|rankingPosition|globalRank|victories:\s*\d/);
});

test("renderização diferencia ausência de dado real e mantém equivalentes textuais", () => {
  const hall = source("src/components/profile/profile-hall.tsx");

  assert.match(hall, /Indisponível — sem fonte real/);
  assert.match(hall, /Arquivo disponível — sem registros/);
  assert.match(hall, /Estatísticas competitivas sem fonte disponível/);
  assert.match(hall, /achievement\.name/);
  assert.match(hall, /achievement\.description/);
  assert.match(hall, /data-scene-fallback="html"/);
  assert.doesNotMatch(hall, /@react-three\/fiber|\bthree\b|Canvas/);
});

test("PROFILE consome somente a API pública da Foundation", () => {
  const shell = source("src/components/profile/profile-command-shell.tsx");
  const hall = source("src/components/profile/profile-hall.tsx");
  const page = source("src/app/profile/page.tsx");

  assert.match(shell, /from "@\/src\/components\/pre-game\/foundation"/);
  assert.match(shell, /mode: "profile"/);
  assert.match(shell, /focus: "insignia"/);
  assert.match(hall, /CommandInsignia/);
  assert.match(hall, /from "@\/src\/components\/pre-game\/foundation"/);
  assert.doesNotMatch(hall, /\.\/command-insignia/);
  assert.doesNotMatch(`${shell}\n${hall}\n${page}`, /@react-three\/fiber|command-scene-canvas|\bthree\b|Canvas/);
});

test("profile possui loading, erro, mobile e reduced-motion explícitos", () => {
  const loading = source("src/app/profile/loading.tsx");
  const error = source("src/app/profile/error.tsx");
  const boundary = source("src/components/profile/profile-boundary-state.tsx");
  const boundaryCss = source("src/components/profile/profile-boundary-state.module.css");
  const hallCss = source("src/components/profile/profile-hall.module.css");
  const environment = source("src/components/profile/profile-environment-state.tsx");
  const environmentCss = source("src/components/profile/profile-environment-state.module.css");

  assert.match(loading, /sem valores simulados/);
  assert.match(error, /Nenhum dado fictício será exibido/);
  assert.match(loading, /ProfileCommandShell/);
  assert.match(error, /ProfileCommandShell/);
  assert.match(boundary, /aria-busy=\{isLoading \|\| undefined\}/);
  assert.match(boundary, /data-scene-fallback="html"/);
  assert.match(boundaryCss, /@media \(max-width: 480px\)/);
  assert.match(boundaryCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(hallCss, /@media \(max-width: 640px\)/);
  assert.match(hallCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(environment, /Conteúdo funcional independente de WebGL/);
  assert.match(environment, /Movimento reduzido ativo/);
  assert.match(environmentCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("WarShell fica transparente apenas dentro da Foundation da PROFILE", () => {
  const shellCss = source("src/components/profile/profile-command-shell.module.css");

  assert.match(shellCss, /:global\(\.wb-shell\)/);
  assert.match(shellCss, /background: transparent/);
  assert.match(shellCss, /:global\(\.wb-header\)/);
});

test("rota força resolução em request-time antes de consultar o perfil", () => {
  const profilePage = source("src/app/profile/page.tsx");

  assert.match(profilePage, /import \{ connection \} from "next\/server"/);
  assert.match(profilePage, /await connection\(\);\s*\n\s*const snapshot = await getCurrentProfileSnapshot\(\)/);
});

test("profile-data participa do test:compile", () => {
  const testConfig = source("tsconfig.test.json");

  assert.match(testConfig, /src\/lib\/profile\/profile-data\.ts/);
});

test("estados de avaliação são opt-in no servidor e não podem ser escolhidos pela URL", () => {
  const profileData = source("src/lib/profile/profile-data.ts");
  const profilePage = source("src/app/profile/page.tsx");

  assert.match(profileData, /PROFILE_EVAL_MODE/);
  assert.match(profileData, /PROFILE_EVAL_STATE/);
  assert.match(profileData, /evaluation-fixture/);
  assert.match(profileData, /createEvaluationSnapshot/);
  assert.match(profileData, /isEvaluationFixture: true/);
  assert.doesNotMatch(profilePage, /searchParams|useSearchParams/);
  assert.doesNotMatch(profileData, /URLSearchParams|searchParams|document\.|window\./);
});

test("cenários loaded, empty-history e no-progression são estruturalmente distintos", () => {
  const profileData = source("src/lib/profile/profile-data.ts");

  assert.match(profileData, /if \(state === "loaded"\)/);
  assert.match(profileData, /evaluationAvailableSections\(\)/);
  assert.match(profileData, /if \(state === "empty-history"\)/);
  assert.match(profileData, /evaluationAvailableSections\(\{ emptyHistory: true \}\)/);
  assert.match(profileData, /if \(state === "no-progression-system"\)/);
  assert.match(profileData, /Sistema de progressão intencionalmente ausente neste cenário de avaliação/);
  assert.match(profileData, /hasMore: true/);
});

test("cenário error passa pelo error boundary real do Next", () => {
  const profileData = source("src/lib/profile/profile-data.ts");
  const error = source("src/app/profile/error.tsx");

  assert.match(profileData, /evaluationState === "error"/);
  assert.match(profileData, /throw new Error\("PROFILE_EVAL_ERROR"\)/);
  assert.match(error, /ProfileBoundaryState/);
  assert.match(error, /reset=|onClick=\{reset\}/);
});

test("fixtures sintéticas são rotuladas na interface e não se apresentam como dados reais", () => {
  const hall = source("src/components/profile/profile-hall.tsx");

  assert.match(hall, /data-evaluation-fixture/);
  assert.match(hall, /Modo de avaliação visual/);
  assert.match(hall, /registros deste cenário são sintéticos/);
  assert.match(hall, /Dados estruturais sintéticos/);
  assert.match(hall, /nenhum registro sintético representa dados reais do usuário/);
});

test("estado visual possui semântica própria sem depender apenas de cor", () => {
  const hall = source("src/components/profile/profile-hall.tsx");
  const stateCss = source("src/components/profile/profile-state.module.css");

  assert.match(hall, /aria-label=\{copy\.label\}/);
  assert.match(hall, /data-state=\{state\}/);
  assert.match(stateCss, /data-state="error"/);
  assert.match(stateCss, /data-state="loaded"/);
  assert.match(stateCss, /forced-colors: active/);
});

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

test("profile possui loading, erro, mobile e reduced-motion explícitos", () => {
  const loading = source("src/app/profile/loading.tsx");
  const error = source("src/app/profile/error.tsx");
  const boundary = source("src/components/profile/profile-boundary-state.tsx");
  const boundaryCss = source("src/components/profile/profile-boundary-state.module.css");
  const hallCss = source("src/components/profile/profile-hall.module.css");
  const insigniaCss = source("src/components/profile/command-insignia.module.css");

  assert.match(loading, /sem valores simulados/);
  assert.match(error, /Nenhum dado fictício será exibido/);
  assert.match(boundary, /aria-busy=\{isLoading \|\| undefined\}/);
  assert.match(boundary, /data-scene-fallback="html"/);
  assert.match(boundaryCss, /@media \(max-width: 480px\)/);
  assert.match(boundaryCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(hallCss, /@media \(max-width: 640px\)/);
  assert.match(hallCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(insigniaCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("estados de avaliação são opt-in no servidor e não podem ser escolhidos pela URL", () => {
  const profileData = source("src/lib/profile/profile-data.ts");
  const profilePage = source("src/app/profile/page.tsx");

  assert.match(profileData, /PROFILE_EVAL_MODE/);
  assert.match(profileData, /PROFILE_EVAL_STATE/);
  assert.match(profileData, /evaluation-fixture/);
  assert.match(profileData, /createEvaluationSnapshot/);
  assert.doesNotMatch(profilePage, /searchParams|useSearchParams/);
  assert.doesNotMatch(profileData, /URLSearchParams|searchParams|document\.|window\./);
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

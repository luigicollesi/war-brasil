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
  assert.equal((profileData.match(/availability: "unavailable"/g) ?? []).length, 4);
  assert.equal((profileData.match(/source: null/g) ?? []).length, 4);
  assert.match(profileData, /Sistema de progressão ainda não integrado/);
  assert.match(profileData, /Estatísticas ainda não possuem contrato de dados do perfil/);
  assert.match(profileData, /Histórico de partidas ainda não está conectado ao perfil/);
  assert.match(profileData, /Conquistas ainda não possuem sistema de origem/);
});

test("renderização diferencia ausência de dado real e mantém equivalentes textuais", () => {
  const hall = source("src/components/profile/profile-hall.tsx");

  assert.match(hall, /Indisponível — sem fonte real/);
  assert.match(hall, /Arquivo disponível — sem registros/);
  assert.match(hall, /achievement\.name/);
  assert.match(hall, /achievement\.description/);
  assert.match(hall, /data-scene-fallback="html"/);
  assert.doesNotMatch(hall, /@react-three\/fiber|\bthree\b|Canvas/);
});

test("profile possui loading, erro, mobile e reduced-motion explícitos", () => {
  const loading = source("src/app/profile/loading.tsx");
  const error = source("src/app/profile/error.tsx");
  const hallCss = source("src/components/profile/profile-hall.module.css");
  const insigniaCss = source("src/components/profile/command-insignia.module.css");

  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /sem valores simulados/);
  assert.match(error, /Nenhum dado fictício será exibido/);
  assert.match(hallCss, /@media \(max-width: 640px\)/);
  assert.match(hallCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(insigniaCss, /@media \(prefers-reduced-motion: reduce\)/);
});

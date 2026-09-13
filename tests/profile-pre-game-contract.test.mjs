import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("PROFILE V2 define as cinco estações do Quartel", () => {
  const hub = source("src/components/profile/command-quarters/profile-command-hub.tsx");
  const spec = source("docs/pre-game/profile/SPEC.md");

  for (const station of ["dossier", "treasury", "network", "campaigns", "quartermaster"]) {
    assert.match(hub, new RegExp(`\\b${station}\\b`));
  }

  assert.match(spec, /Dossiê do Comandante/);
  assert.match(spec, /Tesouraria/);
  assert.match(spec, /Rede de Comando/);
  assert.match(spec, /Livro de Campanha/);
  assert.match(spec, /Intendência/);
  assert.match(spec, /Mesa de Comando/);
});

test("rota V2 resolve snapshot em request-time", () => {
  const page = source("src/app/profile/page.tsx");

  assert.match(page, /import \{ connection \} from "next\/server"/);
  assert.match(page, /getCurrentProfileCommandSnapshot/);
  assert.match(page, /await connection\(\);\s*\n\s*const snapshot = await getCurrentProfileCommandSnapshot\(\)/);
  assert.match(page, /<ProfileCommandHub snapshot=\{snapshot\} \/>/);
  assert.doesNotMatch(page, /searchParams|useSearchParams/);
});

test("contrato V2 separa identidade, economia, social, histórico e loja", () => {
  const contract = source("src/lib/profile/profile-command-contract.ts");
  const fixture = source("src/lib/profile/profile-local-fixture.ts");

  assert.match(contract, /identity: ProfileCommandSection/);
  assert.match(contract, /wallet: ProfileCommandSection/);
  assert.match(contract, /social: ProfileCommandSection/);
  assert.match(contract, /history: ProfileCommandSection/);
  assert.match(contract, /storefront: ProfileCommandSection/);
  assert.match(contract, /"campaign-credit" \| "command-reserve"/);
  assert.match(contract, /title: string \| null/);
  assert.match(contract, /portrait: CommanderPortrait/);
  assert.match(fixture, /source: "local-static"/);
  assert.doesNotMatch(contract, /token|password|secret/i);
});

test("Tesouraria não usa cor como único diferenciador das moedas", () => {
  const fixture = source("src/lib/profile/profile-local-fixture.ts");
  const hub = source("src/components/profile/command-quarters/profile-command-hub.tsx");

  assert.match(fixture, /currency: "campaign-credit"/);
  assert.match(fixture, /currency: "command-reserve"/);
  assert.match(fixture, /label: "Créditos de Campanha"/);
  assert.match(fixture, /label: "Reserva de Comando"/);
  assert.match(fixture, /symbol: "◈"/);
  assert.match(fixture, /symbol: "◆"/);
  assert.match(hub, /currency\.label|currency\.shortLabel/);
  assert.match(hub, /currency\.symbol/);
});

test("busca social é sob demanda e fica fora do snapshot principal", () => {
  const hub = source("src/components/profile/command-quarters/profile-command-hub.tsx");
  const endpoint = source("src/app/api/profile/commanders/search/route.ts");
  const provider = source("src/lib/profile/profile-command-data.ts");

  assert.match(hub, /\/api\/profile\/commanders\/search\?q=/);
  assert.match(endpoint, /searchProfileCommanders/);
  assert.match(provider, /searchLocalCommanders\(query\)/);
  assert.match(provider, /Search is intentionally separate from the main snapshot/);
  assert.doesNotMatch(hub, /LOCAL_COMMANDER_DIRECTORY/);
});

test("Livro de Campanha mantém janela limitada e continuação", () => {
  const contract = source("src/lib/profile/profile-command-contract.ts");
  const fixture = source("src/lib/profile/profile-local-fixture.ts");
  const hub = source("src/components/profile/command-quarters/profile-command-hub.tsx");

  assert.match(contract, /hasMore: boolean/);
  assert.match(contract, /nextCursor: string \| null/);
  assert.match(fixture, /hasMore: true/);
  assert.match(fixture, /nextCursor: "local-op-0415"/);
  assert.match(hub, /Arquivo possui operações adicionais/);
});

test("Intendência é vitrine e não implementa compra falsa", () => {
  const hub = source("src/components/profile/command-quarters/profile-command-hub.tsx");
  const contract = source("src/lib/profile/profile-command-contract.ts");

  assert.match(hub, /Vitrine local · nenhuma compra é persistida nesta etapa/);
  assert.match(contract, /featuredItems/);
  assert.match(contract, /price:/);
  assert.doesNotMatch(hub, /Comprar agora|Compra concluída|purchaseItem|checkout/i);
});

test("PROFILE V2 consome somente a API pública da Foundation", () => {
  const hub = source("src/components/profile/command-quarters/profile-command-hub.tsx");
  const layout = source("src/app/layout.tsx");
  const routeIntent = source("src/components/pre-game/foundation/pre-game-route-intent.ts");

  assert.match(hub, /from "@\/src\/components\/pre-game\/foundation"/);
  assert.match(hub, /useCommandSceneDirective/);
  assert.match(routeIntent, /"\/profile": "profile"/);
  assert.match(layout, /<PreGameCommandRuntime>\{children\}<\/PreGameCommandRuntime>/);
  assert.doesNotMatch(hub, /@react-three\/fiber|command-scene-canvas|\bthree\b|Canvas|cameraPosition|\bfov\b/i);
});

test("desktop e Terminal de Campo mobile possuem composição dedicada", () => {
  const css = source("src/components/profile/command-quarters/profile-command-hub.module.css");

  assert.match(css, /height: 100dvh/);
  assert.match(css, /overflow: hidden/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /data-active-station="dossier"/);
  assert.match(css, /data-active-station="network"/);
  assert.match(css, /data-active-station="campaigns"/);
  assert.match(css, /data-active-station="quartermaster"/);
  assert.match(css, /data-active-station="treasury"/);
  assert.match(css, /grid-template-columns: repeat\(5, 1fr\)/);
});

test("reduced-motion e forced-colors permanecem explícitos", () => {
  const css = source("src/components/profile/command-quarters/profile-command-hub.module.css");
  const boundaryCss = source("src/components/profile/profile-boundary-state.module.css");

  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(boundaryCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("V2 mantém harness de avaliação somente no servidor", () => {
  const provider = source("src/lib/profile/profile-command-data.ts");
  const page = source("src/app/profile/page.tsx");

  assert.match(provider, /PROFILE_EVAL_MODE/);
  assert.match(provider, /PROFILE_EVAL_STATE/);
  assert.match(provider, /PROFILE_COMMAND_EVAL_ERROR/);
  assert.match(provider, /"empty-history"/);
  assert.match(provider, /"empty-social"/);
  assert.match(provider, /"wallet-unavailable"/);
  assert.doesNotMatch(provider, /window\.|document\.|URLSearchParams/);
  assert.doesNotMatch(page, /PROFILE_EVAL_STATE/);
});

test("loading e error boundary continuam preservados durante o redesign", () => {
  const loading = source("src/app/profile/loading.tsx");
  const error = source("src/app/profile/error.tsx");
  const boundary = source("src/components/profile/profile-boundary-state.tsx");

  assert.match(loading, /ProfileSceneBridge/);
  assert.match(error, /ProfileSceneBridge/);
  assert.match(boundary, /aria-busy=\{isLoading \|\| undefined\}/);
  assert.match(error, /reset=|onClick=\{reset\}/);
});

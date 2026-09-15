import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("PROFILE V4 substitui as cinco estações por Dossiê, Arsenal e Intendência", () => {
  const spec = source("docs/pre-game/profile/SPEC.md");

  assert.match(spec, /PROFILE V4/);
  assert.match(spec, /A V4 substitui deliberadamente a composição de cinco estações da V3/);
  assert.match(spec, /1\. \*\*Dossiê\*\*/);
  assert.match(spec, /2\. \*\*Arsenal\*\*/);
  assert.match(spec, /3\. \*\*Intendência\*\*/);
  assert.match(spec, /`\/profile\/arsenal`/);
  assert.match(spec, /`\/profile\/store`/);
  assert.match(spec, /Tesouraria passa a ser informação global de wallet no shell/);
});

test("rota PROFILE resolve snapshot autenticado em request-time", () => {
  const page = source("src/app/profile/page.tsx");

  assert.match(page, /import \{ connection \} from "next\/server"/);
  assert.match(page, /server\/profile\/profile-command-snapshot-service/);
  assert.match(page, /getCurrentProfileCommandSnapshot/);
  assert.match(page, /await connection\(\);\s*\n\s*const snapshot = await getCurrentProfileCommandSnapshot\(\)/);
  assert.match(page, /<ProfileCommandHub snapshot=\{snapshot\} \/>/);
  assert.doesNotMatch(page, /profile-command-data/);
  assert.doesNotMatch(page, /searchParams|useSearchParams/);
});

test("contrato PROFILE separa identidade, economia, social, histórico e loja sem imagem de perfil", () => {
  const contract = source("src/lib/profile/profile-command-contract.ts");
  const fixture = source("src/lib/profile/profile-local-fixture.ts");

  assert.match(contract, /identity: ProfileCommandSection/);
  assert.match(contract, /wallet: ProfileCommandSection/);
  assert.match(contract, /social: ProfileCommandSection/);
  assert.match(contract, /history: ProfileCommandSection/);
  assert.match(contract, /storefront: ProfileCommandSection/);
  assert.match(contract, /CommandCurrencyId = "campaign-credit"/);
  assert.doesNotMatch(contract, /command-reserve/);
  assert.match(contract, /title: string \| null/);
  assert.match(contract, /presence: CommanderPresence/);
  assert.match(contract, /activity: CommanderActivity/);
  assert.match(fixture, /source: "local-static"/);
  assert.doesNotMatch(contract, /CommanderPortrait|\bportrait\s*:/i);
  assert.doesNotMatch(fixture, /\bportrait\s*:/i);
  assert.doesNotMatch(contract, /token|password|secret/i);
});

test("Tesouraria projeta uma única moeda real e não reintroduz moeda premium", () => {
  const fixture = source("src/lib/profile/profile-local-fixture.ts");
  const hub = source("src/components/profile/command-quarters/profile-command-hub.tsx");

  assert.match(fixture, /currency: "campaign-credit"/);
  assert.match(fixture, /label: "Créditos de Campanha"/);
  assert.match(fixture, /symbol: "◈"/);
  assert.match(fixture, /balance: 0/);
  assert.doesNotMatch(fixture, /command-reserve|Reserva de Comando|symbol: "◆"/);
  assert.match(hub, /wallet\.campaignCredit/);
  assert.match(hub, /currency\.shortLabel/);
  assert.match(hub, /currency\.symbol/);
  assert.doesNotMatch(hub, /wallet\.premium|wallet\.common|command-reserve/);
});

test("Rede de Comando cobre amigos, sinais, recentes e busca autenticada sob demanda", () => {
  const network = source("src/components/profile/command-quarters/profile-network-station.tsx");
  const endpoint = source("src/app/api/profile/commanders/search/route.ts");

  assert.match(network, /Amigos na Rede de Comando/);
  assert.match(network, /Solicitações de conexão/);
  assert.match(network, /Contatos recentes/);
  assert.match(network, /\/api\/profile\/commanders\/search\?q=/);
  assert.match(network, /aria-live="polite"/);
  assert.match(network, /maxLength=\{64\}/);
  assert.match(endpoint, /getAuthenticatedSession\(request\)/);
  assert.match(endpoint, /searchCommanderDirectory\(session\.user\.id, query\)/);
  assert.match(endpoint, /MAX_QUERY_LENGTH = 64/);
  assert.match(endpoint, /private, no-store/);
  assert.doesNotMatch(endpoint, /searchProfileCommanders|searchLocalCommanders|LOCAL_COMMANDER_DIRECTORY/);
  assert.doesNotMatch(endpoint, /portrait|image/i);
  assert.doesNotMatch(network, /LOCAL_COMMANDER_DIRECTORY/);
});

test("Livro de Campanha pagina por cursor autenticado e preserva relação dos participantes", () => {
  const contract = source("src/lib/profile/profile-command-contract.ts");
  const campaign = source("src/components/profile/command-quarters/profile-campaign-station.tsx");
  const endpoint = source("src/app/api/profile/history/route.ts");
  const repository = source("src/lib/server/profile/history-repository.ts");

  assert.match(contract, /hasMore: boolean/);
  assert.match(contract, /nextCursor: string \| null/);
  assert.match(campaign, /Participantes da partida/);
  assert.match(campaign, /integrante da sua Rede de Comando/);
  assert.match(campaign, /fora da sua rede/);
  assert.match(campaign, /\/api\/profile\/history\?cursor=/);
  assert.match(campaign, /Carregar mais registros/);
  assert.match(endpoint, /getAuthenticatedSession\(request\)/);
  assert.match(endpoint, /getPlayerMatchHistory\(session\.user\.id/);
  assert.match(endpoint, /decodeMatchHistoryCursor/);
  assert.match(endpoint, /private, no-store/);
  assert.match(repository, /\(match\.finished_at, match\.id\) < \(\$2::timestamptz, \$3::bigint\)/);
  assert.doesNotMatch(repository, /\bOFFSET\b/i);
});

test("Intendência delega economia real e não implementa compra ou preço falsos", () => {
  const quartermaster = source("src/components/profile/command-quarters/profile-quartermaster-station.tsx");
  const contract = source("src/lib/profile/profile-command-contract.ts");

  assert.match(quartermaster, /Catálogo real · nenhuma compra habilitada nesta etapa/);
  assert.match(quartermaster, /href="\/profile\/store"/);
  assert.match(quartermaster, /EM BREVE/);
  assert.match(contract, /featuredItems/);
  assert.match(contract, /status: "announced" \| "available"/);
  assert.doesNotMatch(contract, /\bprice\s*:/);
  assert.doesNotMatch(contract, /StoreItemCategory = [^\n]*portrait/i);
  assert.doesNotMatch(quartermaster, /Comprar agora|Compra concluída|purchaseItem|checkout|price\.amount/i);
});

test("controller mantém estações especializadas fora do arquivo central", () => {
  const hub = source("src/components/profile/command-quarters/profile-command-hub.tsx");

  assert.match(hub, /ProfileNetworkStation/);
  assert.match(hub, /ProfileCampaignStation/);
  assert.match(hub, /ProfileQuartermasterStation/);
  assert.doesNotMatch(hub, /async function handleSearch/);
});

test("PROFILE consome somente a API pública da Foundation", () => {
  const hub = source("src/components/profile/command-quarters/profile-command-hub.tsx");
  const layout = source("src/app/layout.tsx");
  const routeIntent = source("src/components/pre-game/foundation/pre-game-route-intent.ts");

  assert.match(hub, /from "@\/src\/components\/pre-game\/foundation"/);
  assert.match(hub, /useCommandSceneDirective/);
  assert.match(routeIntent, /"\/profile": "profile"/);
  assert.match(routeIntent, /startsWith\("\/profile\/"\)/);
  assert.match(layout, /<PreGameCommandRuntime>\{children\}<\/PreGameCommandRuntime>/);
  assert.doesNotMatch(hub, /@react-three\/fiber|command-scene-canvas|\bthree\b|Canvas|cameraPosition|\bfov\b/i);
  assert.match(hub, /data-scene-fallback="html"/);
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

test("PROFILE mantém harness de avaliação fora do fluxo normal", () => {
  const provider = source("src/lib/profile/profile-command-data.ts");
  const page = source("src/app/profile/page.tsx");

  assert.match(provider, /PROFILE_EVAL_MODE/);
  assert.match(provider, /PROFILE_EVAL_STATE/);
  assert.match(provider, /PROFILE_COMMAND_EVAL_ERROR/);
  assert.match(provider, /"empty-history"/);
  assert.match(provider, /"empty-social"/);
  assert.match(provider, /"empty-storefront"/);
  assert.match(provider, /"wallet-unavailable"/);
  assert.doesNotMatch(provider, /portrait|auth_image|session\.user\.image/i);
  assert.doesNotMatch(provider, /window\.|document\.|URLSearchParams/);
  assert.doesNotMatch(page, /profile-command-data|PROFILE_EVAL_STATE|LOCAL_PROFILE_COMMAND_SNAPSHOT/);
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

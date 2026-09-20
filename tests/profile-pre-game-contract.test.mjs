import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("PROFILE V4 substitui as cinco estações por Dossiê, Arsenal e Intendência", () => {
  const spec = source("docs/pre-game/profile/SPEC.md");
  const shell = source("src/components/profile/v4/profile-shell.tsx");

  assert.match(spec, /PROFILE V4/);
  assert.match(spec, /A V4 substitui deliberadamente a composição de cinco estações da V3/);
  assert.match(spec, /1\. \*\*Dossiê\*\*/);
  assert.match(spec, /2\. \*\*Arsenal\*\*/);
  assert.match(spec, /3\. \*\*Intendência\*\*/);
  assert.match(shell, /href: "\/profile"/);
  assert.match(shell, /href: "\/profile\/arsenal"/);
  assert.match(shell, /href: "\/profile\/store"/);
  assert.doesNotMatch(shell, /"treasury"|"network"|"campaigns"|"quartermaster"/);
});

test("rota PROFILE resolve snapshot autenticado em request-time e renderiza Dossiê V4", () => {
  const page = source("src/app/profile/page.tsx");

  assert.match(page, /import \{ connection \} from "next\/server"/);
  assert.match(page, /server\/profile\/profile-command-snapshot-service/);
  assert.match(page, /getCurrentProfileCommandSnapshot/);
  assert.match(page, /await connection\(\);\s*\n\s*const snapshot = await getCurrentProfileCommandSnapshot\(\)/);
  assert.match(page, /<ProfileShell/);
  assert.match(page, /activeSurface="dossier"/);
  assert.match(page, /getOwnProfileAppearance/);
  assert.match(page, /backgroundAssetRef=\{equippedBackground\}/);
  assert.match(
    page,
    /<ProfileDossier snapshot=\{snapshot\} appearanceTitle=\{equippedTitle\} \/>/,
  );
  assert.doesNotMatch(page, /ProfileCommandHub/);
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

test("Tesouraria usa campaign-credit real e coin.svg como identidade visual V4", () => {
  const fixture = source("src/lib/profile/profile-local-fixture.ts");
  const shell = source("src/components/profile/v4/profile-shell.tsx");

  assert.match(fixture, /currency: "campaign-credit"/);
  assert.match(fixture, /label: "Créditos de Campanha"/);
  assert.match(shell, /src="\/coin\.svg"/);
  assert.match(shell, /wallet\.balance/);
  assert.match(shell, /INDISPONÍVEL/);
  assert.doesNotMatch(shell, /currency\.symbol|>◈</);
  assert.doesNotMatch(shell, /wallet\.premium|wallet\.common|command-reserve/);
});

test("Rede de Comando cobre amigos, sinais, recentes e busca autenticada sob demanda", () => {
  const network = source("src/components/profile/command-quarters/profile-network-station.tsx");
  const dossier = source("src/components/profile/v4/profile-dossier.tsx");
  const endpoint = source("src/app/api/profile/commanders/search/route.ts");

  assert.match(dossier, /ProfileNetworkStation/);
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

test("Livro de Campanha pagina por cursor autenticado e permanece módulo secundário do Dossiê", () => {
  const contract = source("src/lib/profile/profile-command-contract.ts");
  const dossier = source("src/components/profile/v4/profile-dossier.tsx");
  const campaign = source("src/components/profile/command-quarters/profile-campaign-station.tsx");
  const endpoint = source("src/app/api/profile/history/route.ts");
  const repository = source("src/lib/server/profile/history-repository.ts");

  assert.match(dossier, /ProfileCampaignStation/);
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

test("Intendência V4 consome o domínio Economy e não cria autoridade comercial local", () => {
  const page = source("src/app/profile/store/page.tsx");
  const store = source("src/components/profile/v4/profile-store.tsx");
  const profileContract = source("src/lib/profile/profile-command-contract.ts");

  assert.match(page, /getEconomyStorefront\(session\.user\.id\)/);
  assert.match(store, /EconomyStorefrontSnapshot/);
  assert.match(store, /EconomyOffer/);
  assert.match(store, /storefront\.offers/);
  assert.match(store, /storefront\.creditPacks/);
  assert.doesNotMatch(profileContract, /\bprice\s*:/);
  assert.doesNotMatch(profileContract, /StoreItemCategory = [^\n]*portrait/i);
  assert.doesNotMatch(store, /userId/);
  assert.doesNotMatch(store, /R\$\s*\d|price:\s*\d/);
});

test("ProfileShell centraliza navegação enquanto Dossiê mantém módulos especializados", () => {
  const shell = source("src/components/profile/v4/profile-shell.tsx");
  const dossier = source("src/components/profile/v4/profile-dossier.tsx");

  assert.match(shell, /NAV_ITEMS/);
  assert.match(shell, /Dossiê/);
  assert.match(shell, /Arsenal/);
  assert.match(shell, /Intendência/);
  assert.match(dossier, /ProfileNetworkStation/);
  assert.match(dossier, /ProfileCampaignStation/);
  assert.doesNotMatch(shell, /async function handleSearch/);
});

test("PROFILE V4 consome somente a API pública da Foundation", () => {
  const shell = source("src/components/profile/v4/profile-shell.tsx");
  const layout = source("src/app/layout.tsx");
  const routeIntent = source("src/components/pre-game/foundation/pre-game-route-intent.ts");

  assert.match(shell, /from "@\/src\/components\/pre-game\/foundation"/);
  assert.match(shell, /useCommandSceneDirective/);
  assert.match(routeIntent, /"\/profile": "profile"/);
  assert.match(routeIntent, /startsWith\("\/profile\/"\)/);
  assert.match(layout, /<PreGameCommandRuntime>\{children\}<\/PreGameCommandRuntime>/);
  assert.doesNotMatch(shell, /@react-three\/fiber|command-scene-canvas|\bthree\b|Canvas|cameraPosition|\bfov\b/i);
});

test("desktop e mobile possuem composição V4 dedicada", () => {
  const shellCss = source("src/components/profile/v4/profile-shell.module.css");
  const dossierCss = source("src/components/profile/v4/profile-dossier.module.css");
  const arsenalCss = source("src/components/profile/v4/profile-arsenal.module.css");
  const storeCss = source("src/components/profile/v4/profile-store.module.css");

  assert.match(shellCss, /min-height: 100dvh/);
  assert.match(shellCss, /@media \(max-width: 980px\)/);
  assert.match(shellCss, /grid-template-columns: repeat\(3, 1fr\)/);
  assert.match(dossierCss, /@media \(max-width: 520px\)/);
  assert.match(arsenalCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(storeCss, /@media \(max-width: 520px\)/);
});

test("reduced-motion e forced-colors permanecem explícitos na V4", () => {
  const shellCss = source("src/components/profile/v4/profile-shell.module.css");
  const boundaryCss = source("src/components/profile/v4/profile-v4-boundary.module.css");

  assert.match(shellCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(shellCss, /@media \(forced-colors: active\)/);
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

test("loading e error boundary usam a linguagem V4 sem dados simulados", () => {
  const loading = source("src/app/profile/loading.tsx");
  const error = source("src/app/profile/error.tsx");
  const boundary = source("src/components/profile/v4/profile-v4-boundary.tsx");

  assert.match(loading, /ProfileV4Boundary/);
  assert.match(error, /ProfileV4Boundary/);
  assert.match(boundary, /src="\/coin\.svg"/);
  assert.match(error, /onClick=\{reset\}/);
  assert.doesNotMatch(loading, /ProfileSceneBridge|ProfileBoundaryState/);
  assert.doesNotMatch(error, /ProfileSceneBridge|ProfileBoundaryState/);
});

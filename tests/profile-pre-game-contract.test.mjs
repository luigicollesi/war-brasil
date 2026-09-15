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

test("Tesouraria projeta campaign-credit com coin.svg sem violar a identidade textual do PROFILE", () => {
  const fixture = source("src/lib/profile/profile-local-fixture.ts");
  const hub = source("src/components/profile/command-quarters/profile-command-hub.tsx");

  assert.match(fixture, /currency: "campaign-credit"/);
  assert.match(fixture, /label: "Créditos de Campanha"/);
  assert.match(fixture, /symbol: "◈"/);
  assert.match(fixture, /balance: 0/);
  assert.doesNotMatch(fixture, /command-reserve|Reserva de Comando|symbol: "◆"/);
  assert.match(hub, /wallet\.campaignCredit/);
  assert.match(hub, /currency\.shortLabel/);
  assert.match(hub, /data-campaign-credit-mark="true"/);
  assert.match(hub, /backgroundImage: 'url\("\/coin\.svg"\)'/);
  assert.doesNotMatch(hub, /from "next\/image"|<Image\b/);
  assert.doesNotMatch(hub, /\{currency\.symbol\}/);
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

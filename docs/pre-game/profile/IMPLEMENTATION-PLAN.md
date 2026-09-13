# Plano técnico — PROFILE V2 / Quartel do Comandante

Branch: `feature/profile-command-quarters-v2`  
Rota: `/profile`  
Cena: `profile`

## Objetivo

Transformar a PROFILE em um **Quartel do Comandante**: uma tela de jogo pessoal, assimétrica e espacial, que reúne identidade, economia, social, histórico e personalização sem assumir formato de dashboard web.

## Arquitetura atual

A implementação V2 preserva o App Router e a Foundation já integrada em `dev`.

- `page.tsx` permanece Server Component e resolve o snapshot em request-time;
- `ProfileCommandHub` é a boundary cliente responsável por estação ativa, seleção local e diretivas de cena;
- Rede de Comando, Livro de Campanha e Intendência são componentes especializados separados;
- busca social mantém estado e request apenas dentro de `ProfileNetworkStation`;
- a PROFILE consome somente `useCommandSceneDirective()` da API pública da Foundation;
- Three.js, Canvas, câmera e renderer continuam privados da Foundation;
- loading/error continuam usando `ProfileBoundaryState` e `ProfileSceneBridge`;
- a antiga V1 (`ProfileHall`, `profile-data.ts` e estados auxiliares) foi removida para evitar duas fontes de verdade.

## Modelo de produto

Cinco sistemas orbitam a Mesa de Comando:

1. **Dossiê do Comandante** — retrato, nome, handle, título e presença;
2. **Tesouraria** — moeda comum e moeda premium;
3. **Rede de Comando** — amigos, solicitações, contatos recentes e busca;
4. **Livro de Campanha** — partidas recentes, participantes e continuação explícita;
5. **Intendência** — vitrine de itens cosméticos sem checkout fictício.

## Boundary V2

Arquivos de dados:

- `profile-command-contract.ts` — tipos públicos da PROFILE V2;
- `profile-local-fixture.ts` — dados temporários explicitamente `local-static`;
- `profile-command-data.ts` — boundary estável para snapshot e busca;
- `/api/profile/commanders/search` — busca sob demanda sem carregar diretório na página.

`getCurrentProfileCommandSnapshot()` é o único ponto de entrada da rota. Providers futuros de autenticação, wallet, social, histórico e storefront devem substituir a implementação sem vazar payloads específicos para os componentes.

## Componentes V2

`src/components/profile/command-quarters/` contém:

- `profile-command-hub.tsx` — controller visual e composição das estações;
- `profile-network-station.tsx` — roster, sinais recebidos, recentes e busca;
- `profile-campaign-station.tsx` — janela de partidas + participantes do registro selecionado;
- `profile-quartermaster-station.tsx` — vitrine da Intendência;
- `profile-command-format.ts` — formatação e labels compartilhados;
- `profile-command-hub.module.css` — composição principal desktop/mobile;
- `profile-command-refinements.module.css` — refinamentos incrementais sem inflar o controller.

## Estado local inicial

O fluxo normal usa fixture local para permitir implementar e avaliar toda a tela antes dos serviços reais:

- identidade: `Luigi`;
- título: `Estrategista do Sul`;
- moedas: Créditos de Campanha + Reserva de Comando;
- roster social limitado;
- solicitações e contatos recentes;
- três partidas recentes + `hasMore`/cursor;
- três itens em destaque da Intendência.

Toda seção declara `source: "local-static"`; esse conteúdo não deve ser apresentado como dado remoto persistido.

## Cena por estação

A V2 controla somente intenção semântica:

- `dossier` → `focus: insignia`;
- `treasury` → `focus: table`;
- `network` → `focus: table` + alinhamento orbital;
- `campaigns` → `focus: brazil` + explode leve;
- `quartermaster` → `focus: table`.

Nenhuma coordenada, FOV ou objeto Three entra na PROFILE.

## Desktop

Alvo: `1440x900`.

A composição usa:

- Dossiê à esquerda;
- Mesa de Comando no centro;
- Rede de Comando à direita;
- Livro de Campanha na base esquerda/central;
- Intendência na base direita;
- Tesouraria compacta no chrome da PROFILE e expandida na Mesa quando ativa.

Uso principal cabe em `100dvh`; listas volumosas rolam dentro da estação.

## Mobile

Alvo: `390x844`.

A mesma arquitetura vira **Terminal de Campo**:

- uma estação expandida por vez;
- identidade + carteira permanecem no topo;
- seletor inferior com os cinco sistemas;
- nenhuma ação depende de hover;
- Mesa de Comando aparece como estação da Tesouraria e como contexto visual reduzido.

## Rede de Comando

Busca é separada do snapshot principal. `ProfileNetworkStation` consulta `/api/profile/commanders/search?q=...` somente após entrada explícita do usuário.

A implementação atual:

- mostra amigos e presença;
- mostra solicitações recebidas sem fingir aceitação persistente;
- mostra jogadores encontrados em partidas recentes;
- exige pelo menos 2 caracteres para busca;
- limita o input a 64 caracteres;
- limita o provider local a 8 resultados;
- responde com `Cache-Control: private, no-store`;
- usa `aria-live` para resultado vazio/erro;
- não carrega o diretório completo no browser.

Persistência de amizade continua fora desta fase até existir contrato real de backend.

## Livro de Campanha

A V2 mantém três partidas na janela inicial e `hasMore: true` + cursor. O registro selecionado expõe participantes e identifica quais já pertencem à Rede de Comando, sem criar ação de amizade falsa.

Isso protege o design contra histórico ilimitado e prepara paginação real futura.

## Intendência

É apenas showcase. Cada item possui categoria, artwork/fallback e preço com currency id. Nenhum campo `owned`, `purchased`, checkout ou mutação de wallet existe nesta etapa.

## EVAL server-side

`PROFILE_EVAL_MODE=1` + `PROFILE_EVAL_STATE` continua sendo o único mecanismo de fixture.

Estados V2 implementados:

- `guest`;
- `loaded`;
- `partial-data`;
- `wallet-unavailable`;
- `empty-history`;
- `empty-social`;
- `empty-storefront`;
- `error`.

Reduced-motion e fallback continuam pertencendo ao ambiente/Foundation.

## Fases

### Fase 0 — contrato

Concluída:

- nova SPEC;
- novo EVAL;
- branch dedicada derivada de `dev`.

### Fase 1 — dados V2

Concluída:

- contrato V2;
- fixture local isolada;
- boundary de snapshot;
- busca sob demanda;
- `test:compile` atualizado;
- testes comportamentais da V2.

### Fase 2 — composição do Quartel

Concluída no primeiro corte:

- `ProfileCommandHub`;
- cinco estações;
- Mesa de Comando central;
- composição desktop 100dvh;
- Terminal de Campo mobile;
- cena reativa via Foundation.

### Fase 3 — refinamento social

Implementada parcialmente:

- roster com presença;
- solicitações recebidas;
- contatos recentes;
- busca com estado vazio/erro e `aria-live`;
- endpoint `private, no-store` e input limitado.

Pendente para backend futuro:

- aceitar/rejeitar solicitação;
- adicionar/remover amigo;
- bloquear/favoritar;
- persistência real.

### Fase 4 — Dossiê da partida

Implementada parcialmente:

- seleção de registro recente;
- participantes;
- relação com a Rede de Comando;
- janela limitada com continuação.

Pendente para fonte real:

- detalhes completos da partida;
- paginação real;
- navegação para perfil público de outro jogador.

### Fase 5 — Intendência avançada

Pendente:

- ficha de item;
- artwork real;
- categorias completas;
- integração futura com `/store` sem checkout nesta trilha.

### Fase 6 — validação

Pendente como evidência completa:

- lint;
- testes;
- build do HEAD atual;
- 1440x900 e 390x844;
- teclado/touch;
- reduced-motion;
- fallback WebGL;
- score EVAL >= 85 e todos os blockers verdes.

Observação: um build anterior da V2 ficou verde no Vercel; builds subsequentes podem ser bloqueados pelo limite externo de deploy e não devem ser confundidos com erro de compilação.

## Fora de escopo desta branch

- autenticação real;
- banco social;
- compra/checkout;
- persistência de moeda;
- sistema de rank/patente;
- alteração de regras do jogo;
- mudanças em realtime;
- mudanças diretas na implementação Three da Foundation.

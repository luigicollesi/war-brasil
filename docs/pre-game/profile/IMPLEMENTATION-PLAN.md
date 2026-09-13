# Plano técnico — PROFILE V2 / Quartel do Comandante

Branch: `feature/profile-command-quarters-v2`  
Rota: `/profile`  
Cena: `profile`

## Objetivo

Transformar a PROFILE em um **Quartel do Comandante**: uma tela de jogo pessoal, assimétrica e espacial, que reúne identidade, economia, social, histórico e personalização sem assumir formato de dashboard web.

## Arquitetura

A implementação V2 preserva o App Router e a Foundation já integrada em `dev`.

- `page.tsx` permanece Server Component e resolve o snapshot em request-time;
- `ProfileCommandHub` é a pequena boundary cliente responsável apenas por estação ativa, seleção local, busca social e diretivas de cena;
- a PROFILE consome somente `useCommandSceneDirective()` da API pública da Foundation;
- Three.js, Canvas, câmera e renderer continuam privados da Foundation;
- loading/error continuam usando os boundaries existentes durante a migração.

## Modelo de produto

Cinco sistemas orbitam a Mesa de Comando:

1. **Dossiê do Comandante** — retrato, nome, handle, título e presença;
2. **Tesouraria** — moeda comum e moeda premium;
3. **Rede de Comando** — amigos, solicitações, contatos recentes e busca;
4. **Livro de Campanha** — operações recentes com continuação explícita;
5. **Intendência** — vitrine de itens cosméticos sem checkout fictício.

## Boundary V2

Arquivos:

- `profile-command-contract.ts` — tipos públicos da PROFILE V2;
- `profile-local-fixture.ts` — dados temporários explicitamente `local-static`;
- `profile-command-data.ts` — boundary estável para snapshot e busca;
- `/api/profile/commanders/search` — busca sob demanda sem carregar diretório na página.

`getCurrentProfileCommandSnapshot()` é o único ponto de entrada da rota. Providers futuros de autenticação, wallet, social, histórico e storefront devem substituir a implementação sem vazar payloads específicos para os componentes.

## Estado local inicial

O fluxo normal usa fixture local para permitir implementar e avaliar toda a tela antes dos serviços reais:

- identidade: `Luigi`;
- título: `Estrategista do Sul`;
- moedas: Créditos de Campanha + Reserva de Comando;
- roster social limitado;
- três operações recentes + `hasMore`/cursor;
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

A primeira composição usa:

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

## Busca social

Busca é separada do snapshot principal. A UI consulta `/api/profile/commanders/search?q=...` somente após entrada explícita do usuário.

A implementação local:

- exige pelo menos 2 caracteres;
- limita a 8 resultados;
- retorna somente campos públicos do contrato;
- não carrega o diretório completo no browser.

Persistência de amizade ainda não é implementada nesta fase.

## Histórico

A V2 mantém três operações na janela inicial e `hasMore: true` + cursor. Isso protege o design contra histórico ilimitado e prepara paginação real futura.

## Intendência

É apenas showcase. Cada item possui categoria, artwork/fallback e preço com currency id. Nenhum campo `owned`, `purchased`, checkout ou mutação de wallet existe nesta etapa.

## EVAL server-side

`PROFILE_EVAL_MODE=1` + `PROFILE_EVAL_STATE` continua sendo o único mecanismo de fixture.

Estados V2 previstos/implementados:

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

Concluída nesta branch:

- nova SPEC;
- novo EVAL;
- branch dedicada derivada de `dev`.

### Fase 1 — dados V2

Concluída nesta primeira implementação:

- contrato V2;
- fixture local isolada;
- boundary de snapshot;
- busca sob demanda;
- `test:compile` atualizado;
- testes comportamentais iniciais.

### Fase 2 — composição do Quartel

Primeiro corte implementado:

- `ProfileCommandHub`;
- cinco estações;
- Mesa de Comando central;
- composição desktop 100dvh;
- Terminal de Campo mobile;
- cena reativa via Foundation.

### Fase 3 — refinamento social

Próximos passos:

- solicitações detalhadas;
- contatos recentes expandidos;
- serviço de mutações sociais sem backend real até contrato existir;
- feedback completo de busca/erro.

### Fase 4 — Dossiê da Operação

- abrir detalhes da partida;
- participantes e relações sociais;
- conectar jogador recente a partir da operação.

### Fase 5 — Intendência avançada

- ficha de item;
- artwork real;
- categorias;
- integração futura com `/store` sem checkout nesta trilha.

### Fase 6 — validação

- lint;
- testes;
- build;
- 1440x900 e 390x844;
- teclado/touch;
- reduced-motion;
- fallback WebGL;
- score EVAL >= 85 e todos os blockers verdes.

## Fora de escopo desta branch

- autenticação real;
- banco social;
- compra/checkout;
- persistência de moeda;
- sistema de rank/patente;
- alteração de regras do jogo;
- mudanças em realtime;
- mudanças diretas na implementação Three da Foundation.

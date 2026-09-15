# Territory Skins — EVAL v1

## 1. Propósito

Este documento define os gates verificáveis para `docs/economy/territory-skins/SPEC.md`.

Uma implementação NÃO é considerada concluída apenas porque a textura aparece visualmente. Ela precisa provar integridade de catálogo, ownership, equipagem, snapshot, renderer, fallback, performance e preservação de gameplay.

Os testes econômicos genéricos de compra continuam pertencendo a `docs/economy/EVAL.md`. Este EVAL exige a integração desses contratos com `territory_effect`.

## 2. Política de aprovação

- Todo item marcado **BLOCKER** MUST passar.
- Gates visuais MUST ser verificados em desktop e mobile quando aplicável.
- Gates que dependem de concorrência, atomicidade ou autorização MUST possuir evidência automatizada.
- Screenshot isolada não prova ownership, atomicidade, cache ou snapshot.
- Valores cosméticos de opacity/blend MAY variar; o resultado semântico observado é o critério.

## 3. Matriz mínima de ambiente

A implementação MUST ser exercitada em:

```text
Desktop: 1440x900
Mobile: 390x844
prefers-reduced-motion: reduce
prefers-reduced-motion: no-preference
```

Para renderer territorial, a matriz visual MUST incluir os seis PlayerColors:

```text
forest
ocean
sun
ruby
violet
orange
```

## 4. Dados e constraints

### TSKIN-DATA-001 — slot único
**Tipo:** automated — **BLOCKER**

Dado o catálogo inicial, todos os acabamentos territoriais pertencem a `slot = territory_effect`.

**Pass:** nenhum dos cinco acabamentos iniciais está em slot de dados ou outro slot.

### TSKIN-DATA-002 — exclusividade procedural/image
**Tipo:** database integration — **BLOCKER**

Tentar persistir `territory_effect` com:

1. `effect_key != NULL` e `asset_ref != NULL`;
2. `effect_key = NULL` e `asset_ref = NULL`.

**Pass:** ambos são rejeitados pelo contrato persistente/serviço; um procedural válido e um image válido são aceitos.

### TSKIN-DATA-003 — constraint não quebra dados
**Tipo:** database integration — **BLOCKER**

Executar seed/migration e ler cosméticos `dice_attack`, `dice_defense`, `dice_neutral` existentes.

**Pass:** formatos válidos dos dados continuam aceitos e nenhum catálogo de dados é invalidado pela constraint de territory skin.

### TSKIN-DATA-004 — default metálico
**Tipo:** automated — **BLOCKER**

Validar o cosmético padrão.

**Pass:** existe exatamente um default do slot, é procedural, resolve `effect_key=default`, não depende de WebP e está disponível para usuários sem compra.

### TSKIN-DATA-005 — quatro image skins iniciais
**Tipo:** database integration — **BLOCKER**

Validar presença e object keys exatas:

```text
cosmetics/territory-skins/azulejo_brasil.webp
cosmetics/territory-skins/azulejo_ornamental.webp
cosmetics/territory-skins/ceu_estrelado.webp
cosmetics/territory-skins/solar_ornamental.webp
```

**Pass:** existem quatro cosméticos não-default, `effect_key IS NULL`, `asset_ref` igual às keys acima.

## 5. R2 e delivery

### TSKIN-R2-001 — namespace permitido
**Tipo:** automated — **BLOCKER**

Fornecer image skin com object key fora de `cosmetics/territory-skins/` ou extensão diferente de `.webp`.

**Pass:** entrada é rejeitada ou não marcada como image skin válida.

### TSKIN-R2-002 — assetRef canônica
**Tipo:** automated — **BLOCKER**

Inspecionar payload persistido e snapshot.

**Pass:** persiste object key; não persiste URL assinada/temporária como identidade.

### TSKIN-R2-003 — delivery WebP
**Tipo:** integration

Resolver cada um dos quatro assets por meio do delivery oficial da aplicação.

**Pass:** resposta utilizável pelo renderer, com conteúdo WebP, sem necessidade de `ListObjects`.

### TSKIN-R2-004 — catálogo é fonte de verdade
**Tipo:** code/integration — **BLOCKER**

Adicionar em ambiente de teste uma nova image skin válida ao catálogo/oferta sem alterar array temático do frontend.

**Pass:** Store consegue apresentá-la a partir dos dados; não existe requisito de branch React por slug.

## 6. Ownership, oferta e compra

### TSKIN-CATALOG-001 — categoria dinâmica
**Tipo:** integration

Com ofertas ativas de `territory_effect`, abrir Intendência.

**Pass:** a UI apresenta a categoria de texturas territoriais a partir do catálogo/ofertas e mostra os itens elegíveis.

### TSKIN-BUY-001 — compra bem-sucedida
**Tipo:** integration — **BLOCKER**

Dado usuário com saldo suficiente e sem ownership, comprar uma image territory skin por oferta ativa.

**Pass:** transação econômica passa pelos gates de Economy V2 e cria ownership individual da skin.

### TSKIN-BUY-002 — compra não equipa implicitamente
**Tipo:** integration — **BLOCKER**

Comprar skin enquanto outra está equipada.

**Pass:** ownership muda; `profile.cosmetic_loadout.territory_effect` permanece inalterado até ação explícita de equipar.

### TSKIN-BUY-003 — falhas são atômicas
**Tipo:** integration — **BLOCKER**

Reexecutar cenários Economy de saldo insuficiente, oferta indisponível, já possuído, idempotência duplicada e falha transacional usando uma territory skin.

**Pass:** nenhuma falha deixa débito parcial, ownership parcial ou equipagem implícita.

## 7. Arsenal e equipagem

### TSKIN-EQUIP-001 — bay TERRITÓRIO
**Tipo:** visual/integration — **BLOCKER**

Abrir `/profile/arsenal` com usuário que possui default e ao menos uma image skin.

**Pass:** existe bay `TERRITÓRIO`, com preview/nome do acabamento equipado.

### TSKIN-EQUIP-002 — seletor owned-only
**Tipo:** integration — **BLOCKER**

Comparar catálogo total e inventário do usuário.

**Pass:** seletor de equipagem oferece default + skins possuídas e não trata itens não adquiridos como equipáveis.

### TSKIN-EQUIP-003 — bloquear item não possuído
**Tipo:** server integration — **BLOCKER**

Invocar mutation/API de equipagem com cosmeticId de territory skin válida, mas não possuída.

**Pass:** servidor rejeita; loadout permanece igual.

### TSKIN-EQUIP-004 — persistência após reload
**Tipo:** browser integration — **BLOCKER**

Equipar image skin, recarregar a rota e reabrir Arsenal.

**Pass:** mesma skin continua equipada e refletida pelo servidor.

### TSKIN-EQUIP-005 — retorno ao default
**Tipo:** integration

Equipar image skin e depois `default`.

**Pass:** metálico padrão volta a ser o acabamento ativo e a image skin continua no inventário.

## 8. Snapshot de partida

### TSKIN-SNAPSHOT-001 — congelamento no início
**Tipo:** server/database integration — **BLOCKER**

Com jogador usando uma image skin, criar/iniciar partida e inspecionar snapshot cosmético.

**Pass:** snapshot contém identidade estável da skin e `asset_ref`; não contém apenas URL temporária.

### TSKIN-SNAPSHOT-002 — procedural congelado
**Tipo:** server/database integration — **BLOCKER**

Iniciar partida com `default`.

**Pass:** snapshot consegue resolver o modo procedural e `effect_key=default` sem depender do perfil em runtime.

### TSKIN-SNAPSHOT-003 — mudança posterior no perfil não altera partida
**Tipo:** integration — **BLOCKER**

1. iniciar partida com skin A;
2. alterar loadout de perfil para skin B;
3. atualizar/reconectar à partida.

**Pass:** partida continua usando skin A congelada.

### TSKIN-SNAPSHOT-004 — reconnect renova delivery
**Tipo:** integration

Simular URL temporária expirada e reconnect.

**Pass:** `asset_ref` persistente resolve uma nova URL válida sem mudar identidade da skin.

## 9. Renderer SVG

### TSKIN-RENDER-001 — WebP aparece na face
**Tipo:** visual/integration — **BLOCKER**

Equipar cada uma das quatro image skins e abrir mapa com território possuído.

**Pass:** padrão visual correspondente aparece limitado à superfície territorial.

### TSKIN-RENDER-002 — base PlayerColor preservada
**Tipo:** visual matrix — **BLOCKER**

Renderizar a MESMA image skin para `forest`, `ocean`, `sun`, `ruby`, `violet`, `orange` lado a lado ou em fixtures equivalentes.

**Pass:** todos continuam inequivocamente distinguíveis por ownership sem depender de tooltip/nome.

### TSKIN-RENDER-003 — hitbox invariável
**Tipo:** automated/browser — **BLOCKER**

Comparar hit geometry e pointer target antes/depois de aplicar image skin.

**Pass:** geometria/hit layer não muda; camada cosmética não captura pointer.

### TSKIN-RENDER-004 — sem React por território
**Tipo:** structural — **BLOCKER**

Inspecionar implementação.

**Pass:** troca de textura usa registry/material/pattern compartilhado; não cria 42 componentes React independentes dedicados ao acabamento.

### TSKIN-RENDER-005 — estados funcionais prevalecem
**Tipo:** visual matrix — **BLOCKER**

Com skin de alto contraste, capturar:

```text
normal
hover
highlighted
highlighted-hover
selected
target selectable
target blocked
```

**Pass:** estados funcionais continuam distinguíveis e nenhum depende de remover a textura manualmente do usuário.

### TSKIN-RENDER-006 — tropas legíveis
**Tipo:** visual — **BLOCKER**

Renderizar valores de tropas de 1, 2 e 3 dígitos sobre ao menos a image skin visualmente mais complexa.

**Pass:** marcador/número continua legível em desktop e mobile.

### TSKIN-RENDER-007 — markers especiais preservados
**Tipo:** visual/integration

Renderizar território com skin + marker especial existente.

**Pass:** marker não é ocultado ou confundido pela textura.

### TSKIN-RENDER-008 — default não regrede
**Tipo:** visual regression — **BLOCKER**

Comparar mapa de usuário sem skin nova com baseline metálico aprovado.

**Pass:** aparência e interação do default permanecem dentro da tolerância aprovada.

## 10. Ownership durante jogo

### TSKIN-GAME-001 — skin pertence ao jogador
**Tipo:** integration — **BLOCKER**

Jogador A usa skin A e jogador B skin B. A possui território X.

**Pass:** X usa skin A.

### TSKIN-GAME-002 — conquista troca skin
**Tipo:** integration — **BLOCKER**

B conquista X de A.

**Pass:** após atualização autoritativa de owner, X passa a usar skin B sem query de perfil/inventory e sem alterar qualquer ownership cosmético.

### TSKIN-GAME-003 — nenhuma regra alterada
**Tipo:** regression — **BLOCKER**

Executar testes de seleção, ataque, conquista, movimentação e contagem de tropas com default e image skin.

**Pass:** resultados funcionais são iguais; apenas apresentação difere.

### TSKIN-GAME-004 — player antigo sem descriptor
**Tipo:** compatibility — **BLOCKER**

Fornecer estado legado/ausente compatível com a versão anterior.

**Pass:** renderer degrada para `default` e partida permanece utilizável.

## 11. Registry procedural

### TSKIN-PROC-001 — chave conhecida
**Tipo:** automated — **BLOCKER**

Resolver `default`.

**Pass:** registry retorna o acabamento procedural esperado sem consultar banco durante render.

### TSKIN-PROC-002 — chave desconhecida
**Tipo:** automated — **BLOCKER**

Resolver uma `effect_key` inexistente.

**Pass:** fallback visual seguro para `default`; não ocorre execução dinâmica de CSS/JS e não há mutation persistente.

### TSKIN-PROC-003 — banco não contém CSS executável
**Tipo:** structural/security — **BLOCKER**

Inspecionar contrato de dados e renderer.

**Pass:** catálogo armazena chave/metadata; código executável ou CSS arbitrário não é interpretado a partir de string persistida.

## 12. Performance e cache

### TSKIN-PERF-001 — deduplicação por asset
**Tipo:** browser/network — **BLOCKER**

Criar fixture em que múltiplos territórios usam o mesmo `asset_ref`.

**Pass:** renderer reutiliza recurso/pattern/cache; não produz uma requisição de rede nova para cada território.

### TSKIN-PERF-002 — somente skins necessárias no jogo
**Tipo:** browser/network

Catálogo contém várias skins, partida usa apenas duas image skins.

**Pass:** runtime do mapa não baixa todas as demais skins apenas por existirem no catálogo.

### TSKIN-PERF-003 — assinatura estável
**Tipo:** automated — **BLOCKER**

Renovar URL de delivery para o mesmo `cosmeticId/assetRef` sem troca cosmética.

**Pass:** identidade lógica não é tratada como novo cosmético; mudanças necessárias de resource URL podem ser atualizadas sem invalidar toda a superfície por identidade instável.

### TSKIN-PERF-004 — Store lazy-load
**Tipo:** browser/performance

Abrir Store com catálogo maior que a viewport.

**Pass:** previews fora da viewport não causam eager load desnecessário; layout não sofre shift relevante ao carregar.

## 13. Falhas e fallback

### TSKIN-FAIL-001 — asset ausente
**Tipo:** integration — **BLOCKER**

Forçar 404/erro de delivery da image skin equipada.

**Pass:** território usa visual `default`, continua interativo e não quebra a página.

### TSKIN-FAIL-002 — fallback não reequipe
**Tipo:** integration/database — **BLOCKER**

Após TSKIN-FAIL-001, reler perfil/snapshot.

**Pass:** skin autoritativa original continua equipada/congelada; `default` foi somente fallback visual.

### TSKIN-FAIL-003 — fallback não toca economia
**Tipo:** integration/database — **BLOCKER**

Comparar carteira, ledger e inventory antes/depois de erro de asset.

**Pass:** nenhuma linha econômica muda.

### TSKIN-FAIL-004 — falha isolada
**Tipo:** browser/integration

Um jogador usa asset inválido e outro asset válido.

**Pass:** falha do primeiro não impede renderização da skin válida nem funcionamento da partida.

## 14. Store e preview

### TSKIN-UI-001 — cards de image skin
**Tipo:** visual/integration

Abrir Store com os quatro itens iniciais disponíveis.

**Pass:** cards apresentam imagem/nome/estado/preço vindo da oferta; nenhum preço inventado no frontend.

### TSKIN-UI-002 — owned/equipped coerentes
**Tipo:** integration — **BLOCKER**

Comprar e equipar uma skin; voltar à Store.

**Pass:** card reflete `owned` e `equipped` coerentemente com servidor.

### TSKIN-UI-003 — mobile
**Tipo:** visual — **BLOCKER**

Executar Store e Arsenal em 390x844.

**Pass:** preview, preço, ações e bay território são utilizáveis sem sobreposição/overflow destrutivo.

### TSKIN-UI-004 — desktop
**Tipo:** visual — **BLOCKER**

Executar Store e Arsenal em 1440x900.

**Pass:** asset permanece elemento visual dominante da decisão, sem regressão de navegação Profile V4.

### TSKIN-UI-005 — reduced motion
**Tipo:** accessibility — **BLOCKER**

Ativar `prefers-reduced-motion: reduce`.

**Pass:** preview/equip/compra permanecem compreensíveis e utilizáveis sem depender de animação.

## 15. Extensibilidade

### TSKIN-EXT-001 — nova image skin sem renderer temático
**Tipo:** integration — **BLOCKER**

Adicionar fixture de quinta WebP válida via catálogo/oferta.

**Pass:** Store, ownership, equipagem e renderer funcionam sem `if slug === ...`, componente temático ou resolver novo.

### TSKIN-EXT-002 — nova procedural exige registry
**Tipo:** automated/security — **BLOCKER**

Adicionar cosmetic row com `effect_key` nova sem resolver registrado.

**Pass:** execução permanece segura e usa fallback; depois de registrar resolver, a mesma chave pode produzir o novo acabamento.

## 16. Gate cruzado Economy V2

Antes de aprovar territory skins, MUST também estar verde o subconjunto aplicável de `docs/economy/EVAL.md` para:

- catálogo dirigido por banco;
- carteira;
- oferta ativa;
- compra bem-sucedida;
- saldo insuficiente;
- ownership duplicado;
- idempotência;
- concorrência;
- rollback/atomicidade;
- equipagem owned-only;
- snapshot cosmético.

Este EVAL não substitui os testes econômicos genéricos.

## 17. Evidência mínima para PR

O PR de implementação MUST incluir:

1. IDs `TSKIN-*` atendidos;
2. migration/schema diff;
3. testes automatizados relevantes;
4. captura da mesma skin nas seis cores;
5. desktop + mobile de Store/Arsenal;
6. evidência de network/cache demonstrando reuso do asset;
7. evidência de fallback R2 sem mutation persistente;
8. evidência de snapshot e conquista entre dois jogadores com skins diferentes;
9. `npm test`, `npm run lint` e `npm run build` verdes conforme gates do projeto.

## 18. Critério de conclusão

A trilha `territory-skins` é considerada implementada somente quando todos os BLOCKERs deste documento e os gates Economy V2 aplicáveis estiverem verdes no branch integrado.

# EVAL — Economia, Loja e Cosméticos

Avaliar conforme `SPEC.md` e os padrões de qualidade vigentes do projeto.

Aprovação exige **todos os BLOCKERs verdes**. Nenhuma compra, recompensa ou grant econômico pode ser habilitado como atalho para satisfazer os cenários desta entrega.

## Gates BLOCKER — carteira e moeda

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-WAL-01 | existe somente `campaign-credit` como moeda real ativa desta entrega | schema/contract test |
| ECO-WAL-02 | todo usuário existente recebe saldo persistente exatamente `0` no upgrade | DB integration |
| ECO-WAL-03 | todo novo comandante inicia com saldo persistente exatamente `0` | onboarding integration |
| ECO-WAL-04 | saldo não pode ficar negativo por constraint | DB negative test |
| ECO-WAL-05 | valores monetários são inteiros | schema/type review |
| ECO-WAL-06 | nenhum fluxo normal concede créditos | source/API inspection |
| ECO-WAL-07 | nenhum fluxo normal gasta créditos | source/API inspection |
| ECO-WAL-08 | não existe endpoint público funcional de grant/reward/purchase/transferência | route inventory/security review |
| ECO-WAL-09 | saldo `0` projetado no Profile vem de fonte persistente disponível, não de fallback sintético | integration/DTO |
| ECO-WAL-10 | ledger permanece sem entradas após cadastro, login, vitória, derrota e navegação normal | integration |

## Gates BLOCKER — catálogo e conjuntos

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-CAT-01 | catálogo possui os quatro itens default com IDs estáveis e slots corretos | migration/query test |
| ECO-CAT-02 | catálogo possui Exército com ataque, defesa e neutro corretos | migration/asset contract |
| ECO-CAT-03 | catálogo possui Lanças com ataque, defesa e neutro corretos | migration/asset contract |
| ECO-CAT-04 | `set.exercito` agrupa exatamente os três itens esperados nesta entrega | DB test |
| ECO-CAT-05 | `set.lancas` agrupa exatamente os três itens esperados nesta entrega | DB test |
| ECO-CAT-06 | Exército e Lanças iniciam como `announced` | DB/storefront test |
| ECO-CAT-07 | conjunto não cria ownership próprio nem implica ownership de todos os itens | schema/service review |
| ECO-CAT-08 | ID de cosmético é independente do caminho físico do asset | schema/contract review |
| ECO-CAT-09 | item `retired` continua resolvível para ownership/snapshot já existente | compatibility test |

## Gates BLOCKER — inventário

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-INV-01 | novo comandante possui os quatro defaults | integration |
| ECO-INV-02 | usuários existentes recebem somente os quatro defaults no backfill desta entrega | upgrade integration |
| ECO-INV-03 | ownership é único por usuário/item | constraint/concurrency test |
| ECO-INV-04 | Exército não é concedido automaticamente | integration |
| ECO-INV-05 | Lanças não é concedido automaticamente | integration |
| ECO-INV-06 | browser não consegue conceder item a si próprio | route/security test |
| ECO-INV-07 | reexecutar inicialização não duplica grants nem altera saldo | idempotency integration |

## Gates BLOCKER — loadout

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-LOAD-01 | existem exatamente quatro slots nesta entrega: ataque, defesa, neutro e efeito territorial | schema/contract |
| ECO-LOAD-02 | os quatro defaults começam equipados | onboarding/upgrade integration |
| ECO-LOAD-03 | usuário só equipa item que possui | service/DB negative test |
| ECO-LOAD-04 | usuário não equipa item em slot incompatível | service/DB negative test |
| ECO-LOAD-05 | equipar o mesmo item novamente é idempotente | integration |
| ECO-LOAD-06 | equipar um slot preserva os outros três | integration |
| ECO-LOAD-07 | mutação deriva ator de `session.user.id`, nunca de `userId` do browser | security/source inspection |
| ECO-LOAD-08 | equipagem nunca altera saldo nem ledger | integration |
| ECO-LOAD-09 | estado legado/incompleto resolve fallback default sem quebrar runtime | compatibility test |

## Gates BLOCKER — storefront / Intendência

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-STORE-01 | Profile mostra saldo real `◈ 0` quando wallet está disponível | E2E/DOM |
| ECO-STORE-02 | Intendência possui entrada clara para a loja | E2E/DOM |
| ECO-STORE-03 | `/profile/store` é autenticada e utiliza a cena `profile` existente | route/Foundation E2E |
| ECO-STORE-04 | Exército aparece como nova remessa/anúncio | E2E/DOM |
| ECO-STORE-05 | Lanças aparece como nova remessa/anúncio | E2E/DOM |
| ECO-STORE-06 | itens `announced` possuem estado inequívoco `EM BREVE` ou equivalente | interaction review |
| ECO-STORE-07 | nenhum item sem fluxo de aquisição oferece CTA `COMPRAR` | E2E/DOM negative assertion |
| ECO-STORE-08 | nenhum clique em preview de item não possuído altera inventário/loadout | interaction/integration |
| ECO-STORE-09 | nenhum preço é inventado para anúncio sem oferta ativa | DTO/DOM review |
| ECO-STORE-10 | defaults aparecem como possuídos e podem ser equipados | E2E/integration |
| ECO-STORE-11 | storefront real não depende da fixture sintética de Profile | source/integration |

## Gates BLOCKER — dados

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-DICE-01 | iniciativa/rolagem neutra usa `dice_neutral` do jogador | integration/visual contract |
| ECO-DICE-02 | atacante usa `dice_attack` do próprio jogador | battle integration |
| ECO-DICE-03 | defensor usa `dice_defense` do próprio jogador | battle integration |
| ECO-DICE-04 | dois jogadores podem usar skins diferentes na mesma batalha | multi-player E2E |
| ECO-DICE-05 | fallback 2D e apresentação 3D resolvem o mesmo cosmético | contract/E2E |
| ECO-DICE-06 | skin não altera RNG, valores ou balanceamento adaptativo | regression/property tests |
| ECO-DICE-07 | skin não altera geometria, collider, trajetória ou detecção de face | dice physics regression |
| ECO-DICE-08 | ausência/falha de asset não altera resultado autoritativo da rolagem | failure test |

## Gates BLOCKER — efeitos territoriais

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-MAP-01 | `territory.effect.default` existe, é possuído e equipado por padrão | DB/integration |
| ECO-MAP-02 | efeito territorial preserva identificação inequívoca do `PlayerColor` | visual review nas seis cores |
| ECO-MAP-03 | efeito não altera hitbox, seleção, hover, foco ou alvo válido | interaction regression |
| ECO-MAP-04 | efeito não reduz legibilidade do marcador de tropas | desktop/mobile visual |
| ECO-MAP-05 | mapa não consulta inventário por território | source/performance review |
| ECO-MAP-06 | mudança cosmética não recria estado autoritativo dos 42 territórios | render/performance review |

## Gates BLOCKER — snapshot de partida

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-GAME-01 | loadout efetivo é congelado no início da partida | DB/start-game integration |
| ECO-GAME-02 | alterar Profile durante partida não altera cosméticos da partida ativa | multi-client E2E |
| ECO-GAME-03 | reconnect recupera exatamente o snapshot cosmético da partida | reconnect E2E |
| ECO-GAME-04 | todos os clientes veem a mesma configuração cosmética por jogador | multi-client E2E |
| ECO-GAME-05 | bots usam os quatro defaults | integration |
| ECO-GAME-06 | GameSnapshot expõe somente configuração visual necessária | DTO snapshot/security |
| ECO-GAME-07 | GameSnapshot não expõe saldo, ledger, inventário completo ou `auth.user.id` | security snapshot |
| ECO-GAME-08 | runtime não consulta Profile/store a cada batalha/renderização | architecture/source inspection |

## Gates BLOCKER — segurança e boundary

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-SEC-01 | wallet, inventory e loadout próprios exigem sessão autenticada | route/service tests |
| ECO-SEC-02 | browser não é autoridade para saldo, ownership, status, slot ou oferta | negative tests/source review |
| ECO-SEC-03 | React components não executam SQL | architecture inspection |
| ECO-SEC-04 | Route Handlers não retornam `SELECT *` de tabelas econômicas internas | source/DTO review |
| ECO-SEC-05 | catálogo público não vaza ownership privado de outros usuários | API snapshot |
| ECO-SEC-06 | outros jogadores recebem somente cosméticos congelados necessários à partida | DTO/security |
| ECO-SEC-07 | não existe mutação financeira parcial ou não transacional escondida no runtime | source inspection |

## Gates BLOCKER — performance de assets

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-PERF-01 | listagem da loja não baixa automaticamente todos os SVGs HQ | browser network evidence |
| ECO-PERF-02 | cards usam preview otimizado ou equivalente de baixo custo | asset/network review |
| ECO-PERF-03 | SVG HQ é carregado sob demanda ou quando necessário ao item equipado | network evidence |
| ECO-PERF-04 | troca de estação/seleção da loja não força remontagem desnecessária da Foundation | React/browser evidence |
| ECO-PERF-05 | mapa permanece sem fetch por território ou por frame | network/source inspection |

## Gates BLOCKER — migrations

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| ECO-DB-01 | migrations aplicam em banco limpo | integration DB |
| ECO-DB-02 | migrations aplicam sobre baseline atual | upgrade integration |
| ECO-DB-03 | migrations são idempotentes segundo o runner atual | repeat migration test |
| ECO-DB-04 | usuários existentes recebem wallet zero + quatro defaults sem perda de dados | upgrade fixture |
| ECO-DB-05 | novos usuários são inicializados de forma idempotente | onboarding integration |
| ECO-DB-06 | constraints impedem saldo negativo, ownership duplicado e equipagem inválida conforme modelagem final | DB negative tests |
| ECO-DB-07 | catálogo seed é determinístico | clean/repeat DB test |

## Cenários obrigatórios

### Carteira

- `ECO-S1`: usuário existente recebe `◈ 0` após upgrade;
- `ECO-S2`: novo usuário completa onboarding e recebe `◈ 0`;
- `ECO-S3`: usuário vence partida e continua com `◈ 0`;
- `ECO-S4`: usuário perde partida e continua com `◈ 0`;
- `ECO-S5`: usuário faz logout/login e saldo continua `◈ 0`;
- `ECO-S6`: tentativa de criar saldo negativo é rejeitada.

### Inventário e loadout

- `ECO-S7`: novo usuário possui os quatro defaults;
- `ECO-S8`: usuário equipa novamente um default;
- `ECO-S9`: usuário tenta equipar Exército sem possuir;
- `ECO-S10`: usuário tenta equipar dado de defesa no slot de ataque;
- `ECO-S11`: atualização de ataque preserva defesa, neutro e território;
- `ECO-S12`: inicialização executada duas vezes não duplica nada.

### Loja

- `ECO-S13`: abrir Intendência pelo Profile;
- `ECO-S14`: abrir `/profile/store`;
- `ECO-S15`: visualizar Exército anunciado;
- `ECO-S16`: visualizar Lanças anunciado;
- `ECO-S17`: abrir preview detalhada sem adquirir item;
- `ECO-S18`: confirmar ausência de CTA de compra e preço inventado.

### Partida

- `ECO-S19`: dois jogadores iniciam partida com defaults;
- `ECO-S20`: jogador com skin de teste autorizada usa ataque personalizado e defesa padrão;
- `ECO-S21`: atacante e defensor usam skins diferentes simultaneamente;
- `ECO-S22`: jogador muda loadout no Profile durante partida e partida ativa não muda;
- `ECO-S23`: jogador reconecta e mantém visual congelado;
- `ECO-S24`: bot participa usando defaults;
- `ECO-S25`: fallback 2D mostra a mesma escolha que 3D.

### Território

- `ECO-S26`: cada uma das seis cores com efeito default permanece reconhecível;
- `ECO-S27`: aplicar efeito de teste não altera seleção/hover;
- `ECO-S28`: troca de cosmético entre partidas não altera dados autoritativos do território.

## Testes de concorrência obrigatórios

Mesmo sem compra, executar pelo menos:

1. duas inicializações simultâneas do mesmo usuário;
2. duas equipagens simultâneas do mesmo slot;
3. equipagens concorrentes em slots diferentes;
4. leitura de loadout concorrente com equipagem;
5. início de partida concorrente com alteração de loadout.

O resultado MUST ser determinístico. O snapshot da partida deve refletir uma configuração transacionalmente consistente e permanecer congelado depois de criado.

## Auditoria de superfícies mutáveis

A auditoria MUST enumerar todos os endpoints/serviços capazes de alterar:

- `economy.*`;
- `inventory.*`;
- loadout cosmético em `profile.*`;
- snapshot cosmético em `game.*`.

Nesta entrega, o resultado esperado para dinheiro é: **nenhuma mutação exposta ao usuário**.

Para inventário, o resultado esperado é: grants somente pela inicialização/migration controlada dos defaults.

Para loadout, a única mutação normal esperada é equipar item já possuído.

## Auditoria de dados

Para cada campo econômico ou cosmético visível registrar:

- fonte autoritativa;
- disponibilidade;
- política de acesso;
- DTO de saída;
- se é persistente, derivado ou snapshot.

`0`, lista vazia e `não possuído` somente podem ser exibidos como fatos quando a respectiva fonte real foi consultada com sucesso.

## Evidência visual mínima

Capturar pelo menos:

- Profile/Tesouraria com `◈ 0`;
- Profile/Intendência com os dois anúncios;
- `/profile/store` desktop 1440x900;
- `/profile/store` mobile 390x844;
- detalhe de Exército;
- detalhe de Lanças;
- loadout com os quatro defaults;
- batalha com skins distintas de atacante/defensor em harness controlado;
- território nas seis cores com efeito default.

Reduced-motion e fallback da Foundation continuam obrigatórios onde aplicáveis.

## Performance

Validar por DevTools ou evidência automatizada:

- nenhum carregamento em lote dos seis SVGs HQ apenas ao abrir a loja;
- ausência de N+1 para inventário/loadout;
- ausência de consulta Profile por território;
- ausência de consulta Profile por frame/rolagem;
- resolução de catálogo e loadout em número limitado de queries;
- mudança cosmética não causa regressão perceptível de interação do mapa.

## Fora do EVAL desta entrega

Não avaliar como funcionalidade implementada:

- compra;
- checkout;
- preço real;
- pagamento;
- moeda premium;
- ganho de créditos;
- recompensa de partida;
- daily reward;
- battle pass;
- marketplace;
- trading;
- gifting;
- refund.

Qualquer uma dessas funcionalidades aparecendo como ativa nesta entrega sem SPEC adicional é regressão.

## Gate de conclusão

A entrega econômica só pode ser considerada pronta quando:

- todos os BLOCKERs acima estiverem verdes;
- wallet real substituir o estado `unavailable` no Profile;
- storefront real substituir a fixture/estado `unavailable` da Intendência;
- usuários novos e existentes tiverem saldo real `0`;
- defaults estiverem possuídos/equipados;
- Exército e Lanças estiverem anunciados e não adquiríveis;
- partida utilizar snapshot cosmético congelado;
- nenhuma regra competitiva tiver sido alterada;
- nenhum endpoint de compra/recompensa/grant econômico tiver sido introduzido;
- migrations passarem em banco limpo e upgrade.

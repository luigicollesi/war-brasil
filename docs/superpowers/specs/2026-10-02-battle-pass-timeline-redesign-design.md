# Battle Pass Timeline Redesign — Design

**Data:** 2026-10-02  
**Rota:** `/campaign`  
**Branch de integração:** `dev`  
**Tipo:** redesign estrutural de frontend  
**Referências obrigatórias:** `skills/frontend-quality/SKILL.md`, `docs/progression/battle-pass/SPEC.md`, `docs/pre-game/visual-language.md`, `docs/pre-game/opening-animation-standard.md`, `docs/pre-game/foundation/SPEC.md`.

## 1. Objetivo

Reestruturar o display do Passe de Campanha para abandonar o layout atual baseado em cards e páginas artificiais de oito níveis.

A experiência alvo deve:

- expor os 100 níveis como uma única progressão contínua;
- desktop/tablet amplo: usar um único scroll horizontal;
- manter Trilha de Elite acima do eixo e Trilha Livre abaixo;
- mobile: transformar a mesma progressão em um único scroll vertical;
- no mobile, manter Elite à esquerda do eixo e Livre à direita;
- remover visual de cards/caixas como unidade dominante;
- minimizar bordas visíveis em toda a página;
- preservar claim individual, claim-all, agrupamentos, compra Elite e reveal;
- integrar `/campaign` à Pre-game Foundation para preservar o fundo da Home;
- fazer Home → Campanha manter continuidade visual semelhante a Home → Operações;
- não duplicar Canvas, mapa, regras de progressão ou lógica econômica.

## 2. Problemas do layout atual

O componente atual:

- calcula `railStart`;
- fatia apenas oito níveis via `visibleLevels`;
- exige botões `ANTERIORES`, `NÍVEL ATUAL` e `PRÓXIMOS`;
- representa cada nível como um `article.level` encaixotado;
- representa cada recompensa como `RewardCard` ou `RewardGroupCard`;
- usa múltiplas bordas para separar nível, reward e agrupamento;
- no mobile desmonta a metáfora de trilha e empilha níveis como cards verticais;
- usa um background CSS próprio em vez da Foundation compartilhada.

Isso fragmenta visualmente uma progressão que conceitualmente é única e cria excesso de chrome.

## 3. Princípio de design

O Passe deve parecer uma **linha contínua de campanha**, não uma grade de cards.

Hierarquia visual:

1. cena Foundation da Home ao fundo;
2. hero/progresso/controle Elite;
3. eixo temporal dos 100 níveis;
4. rewards ancoradas ao nível;
5. estados de claim por tipografia, opacidade, símbolo e brilho discreto;
6. bordas somente quando necessárias para foco, controle interativo ou diálogo.

O espaço negativo substitui caixas e divisores.

## 4. Arquitetura da Foundation

### 4.1 Novo modo

Adicionar `campaign` a `CommandSceneMode`.

`/campaign` passa a resolver para:

```text
mode = campaign
focus = table
conflictLevel = 0
territoryExplode = 0
orbitalAlignment = 0
entranceState = settled
```

O modo Campaign deve reutilizar o mesmo `CommandShell`/Canvas/scene runtime usado pelas superfícies de pré-jogo.

### 4.2 Continuidade Home → Campaign

A Home já usa `transitioningTo` e um overlay curto durante navegação.

Para Campaign:

- o clique em CAMPANHA continua marcando `transitioningTo="campaign"`;
- o chrome da Home pode reduzir opacidade/transform;
- a Foundation permanece como cena persistente;
- a nova rota monta o conteúdo do Passe sobre o mesmo runtime;
- o conteúdo Campaign entra por `opacity + transform`;
- não criar segundo Canvas;
- não copiar o mapa para background CSS;
- não executar novamente a Genesis da Home.

A sensação deve ser equivalente à continuidade Home → Operações: mudança de superfície dentro do mesmo espaço de comando.

### 4.3 Reduced motion

Com `prefers-reduced-motion: reduce`:

- sem coreografia espacial de entrada;
- Campaign entra diretamente no estado estável;
- a Foundation permanece disponível;
- nenhum recurso funcional é removido.

## 5. Estrutura da página

A composição alvo é:

```text
CampaignExperience
├── CampaignUtility
├── CampaignHero
│   ├── season identity
│   ├── current level
│   ├── XP progress
│   └── season timing
├── CampaignEliteControl
├── CampaignRewardsHeader
│   └── ClaimAll
└── BattlePassTimeline
    ├── track labels
    ├── current-level navigation
    └── BattlePassTimelineViewport
        └── 100 BattlePassLevelNodes
```

Claim reveal permanece como camada modal separada e acessível.

## 6. Timeline desktop

### 6.1 Geometria

Um único container:

```css
overflow-x: auto;
overflow-y: hidden;
```

Todos os 100 níveis existem na mesma sequência.

Cada nível possui largura estável suficiente para:

- número;
- rewards Elite;
- marcador do eixo;
- rewards Livre.

Conceitualmente:

```text
           TRILHA DE ELITE

 reward      reward                 reward
   │           │                      │
───●────●──────●────●────●────●──────●────→
  01   02     03   04   05   06     07

        reward              reward

           TRILHA LIVRE
```

### 6.2 Ordem vertical

Por nível:

```text
premium rewards
connector
level marker / axis
connector
free rewards
```

O eixo é contínuo entre todos os níveis, não uma linha recriada dentro de cada card.

### 6.3 Scroll

Suportar:

- trackpad horizontal;
- shift + mouse wheel quando fornecido pelo browser;
- drag/touch nativo;
- teclado quando o viewport recebe foco;
- botão `NÍVEL ATUAL` usando `scrollIntoView`.

Remover:

- `railStart`;
- `visibleLevels`;
- `maxRailStart`;
- `showPreviousLevels`;
- `showNextLevels`;
- paginação de 8 níveis.

## 7. Timeline mobile

Breakpoint inicial de referência: `max-width: 760px`, ajustável conforme validação visual.

A timeline muda de orientação, não de semântica.

### 7.1 Geometria

```text
ELITE              LIVRE

reward
   ──── 01 ────
                reward
   ──── 02 ────
reward
   ──── 03 ────
                reward
   ──── 04 ────
        ↓
```

O eixo central é vertical.

Cada level node usa três zonas:

```text
premium | level-axis | free
```

Decisão V1:

- Elite à esquerda;
- Livre à direita.

### 7.2 Scroll

O viewport usa scroll vertical nativo.

O usuário percorre os níveis naturalmente para cima/baixo.

Não deve existir:

- carrossel horizontal no mobile;
- cards empilhados;
- paginação por grupos;
- scroll horizontal acidental da página.

### 7.3 Dimensões

Rewards devem caber em aproximadamente metade da largura disponível, descontando eixo e gutters.

Nomes longos podem usar clamp de texto; o conteúdo completo deve continuar disponível via contexto acessível/título apropriado quando necessário.

## 8. Reward presentation sem cards

Substituir visualmente `RewardCard` e `RewardGroupCard` por uma unidade leve `BattlePassReward`.

Uma reward contém apenas:

- status curto;
- preview;
- nome;
- raridade quando relevante;
- ação de claim quando aplicável.

Não possuir borda permanente.

Estados:

### locked

- opacidade reduzida;
- label `NÍVEL N`;
- sem depender somente de cor.

### premium_locked

- opacidade reduzida;
- label/ícone Elite;
- semanticamente distinto de locked.

### claimable

- contraste normal;
- brilho/halo dourado discreto;
- CTA textual ou botão mínimo com área interativa >= 44px;
- foco visível explícito.

### claiming

- estado textual `COLETANDO...`;
- interação desabilitada;
- sem layout shift.

### claimed

- menor contraste;
- `✓ COLETADO`;
- não esconder a reward.

## 9. Reward groups

`presentationGroupKey` continua sendo respeitado.

Um grupo não vira card.

Exemplo para trio inicial Elite:

- previews podem aparecer agrupados lado a lado/empilhados dentro da mesma área visual;
- uma única legenda de conjunto;
- uma única ação `COLETAR CONJUNTO`;
- nenhum contorno externo permanente.

A semântica e a lógica de `groupState()` continuam reutilizáveis.

## 10. Nível atual

O nível atual deve ser identificável sem caixa.

Desktop:

- marcador do eixo maior;
- número dourado;
- pequeno label `ATUAL`;
- halo discreto.

Mobile:

- mesmo tratamento no eixo vertical;
- nenhuma borda envolvendo as rewards laterais.

Ao abrir Campaign:

- posicionar o viewport próximo ao nível atual;
- preservar contexto anterior e posterior;
- não animar um percurso longo desde o nível 1.

`NÍVEL ATUAL` continua disponível como ação de navegação.

## 11. Níveis sem recompensa

Não renderizar caixas `SEM RECOMPENSA`.

O nível permanece no eixo.

Opcionalmente pode existir label extremamente discreto somente quando necessário para legibilidade, mas a preferência é deixar o espaço vazio.

## 12. Hero e controle Elite

A página inteira segue a regra de borda mínima.

### Hero

Remover divisórias decorativas desnecessárias.

Manter:

- temporada;
- nível;
- XP;
- data;
- progress bar.

### Elite

O atual `premiumPanel` deixa de parecer card.

Apresentação alvo:

- label TRILHA DE ELITE;
- estado/preço em tipografia forte;
- texto explicativo curto;
- CTA;
- confirmação pode continuar estruturada, pois é uma ação financeira.

A confirmação de compra é exceção válida para container visual delimitado, por segurança e legibilidade.

## 13. Borda mínima

Bordas permitidas:

- foco visível;
- botões/controles quando necessário;
- confirmação financeira;
- modal/reveal;
- progress bar se necessária à leitura;
- elementos acessíveis que perderiam affordance sem delimitação.

Evitar bordas em:

- level node;
- reward;
- reward group;
- trilhas;
- sections;
- labels;
- containers puramente decorativos.

Separação deve preferir:

- spacing;
- alinhamento;
- contraste;
- tipografia;
- opacidade;
- linhas do próprio eixo.

## 14. Componentização alvo

Criar unidades focadas:

```text
src/components/progression/battle-pass/
  battle-pass-page.tsx
  battle-pass-page.module.css
  battle-pass-timeline.tsx
  battle-pass-timeline.module.css
  battle-pass-reward.tsx
```

Responsabilidades:

### battle-pass-page.tsx

- orchestration;
- purchase Elite;
- claims;
- feedback/reveal;
- hero;
- montagem da timeline.

### battle-pass-timeline.tsx

- orientation/responsive structure;
- level refs;
- initial current-level positioning;
- scroll-to-current;
- mapping dos 100 níveis;
- track geometry.

### battle-pass-reward.tsx

- visual de reward;
- grouped reward presentation;
- reward state;
- claim action.

Não duplicar regras de state de backend.

## 15. Data flow

Nenhum contrato de backend muda.

Entrada continua:

```text
BattlePassSnapshot
  -> BattlePassPage
  -> BattlePassTimeline
  -> BattlePassLevelPresentation
  -> BattlePassReward
```

Claims continuam usando IDs autoritativos existentes.

O frontend não calcula:

- elegibilidade;
- ownership;
- XP autoritativo;
- preço real;
- estado persistido.

## 16. Performance

Existem 100 níveis, mas os level nodes são leves.

MUST:

- manter previews estáticos;
- usar lazy loading para imagens fora do viewport;
- evitar renderizadores 3D na timeline;
- não criar observers/timers por reward;
- evitar event listener por nível quando delegação/ref única resolve;
- não atualizar React state continuamente durante scroll;
- não virtualizar prematuramente a timeline se DOM estático + imagens lazy forem suficientes.

A virtualização só entra se profiling real demonstrar necessidade.

## 17. Acessibilidade

Seguir `skills/frontend-quality/SKILL.md`.

MUST:

- timeline navegável por teclado;
- foco visível;
- áreas interativas >= 44px;
- estados não dependerem apenas de cor;
- preservar labels Elite/Livre em leitores de tela;
- feedback de claim continuar via `aria-live`;
- modal/reveal preservar focus trap e restore existentes;
- respeitar reduced motion;
- não criar controles interativos aninhados;
- evitar scroll trapping.

A orientação visual pode mudar por media query sem alterar a ordem semântica útil do DOM.

## 18. Responsividade

Validar pelo menos:

- 1440x900;
- 1366x768;
- desktop de baixa altura;
- tablet;
- 390x844;
- 360x800;
- viewport estreito <= 360px.

Critérios:

- nenhum overflow horizontal acidental da página;
- desktop mantém apenas timeline horizontal;
- mobile mantém apenas timeline vertical;
- reward não cobre eixo;
- CTA continua utilizável;
- labels não colidem;
- current level continua identificável.

## 19. Transição de rota

Campaign deve participar da Foundation route intent.

Arquivos afetados conceitualmente:

```text
scene-contract.ts
pre-game-route-intent.ts
command-scene.tsx / command-scene-canvas.tsx se modo precisar de preset próprio
command-home scene intent / styles para transition focus
campaign page/layout boundary
```

A rota não deve montar sua própria cena 3D.

O fundo CSS atual de `.surface` deve deixar de ser a autoridade visual principal quando a Foundation estiver ativa.

## 20. Testes

### Source/contract tests

Cobrir:

- `campaign` existe em `COMMAND_SCENE_MODES`;
- `/campaign` resolve para campaign;
- não existe mais slicing de oito níveis;
- não existem `showPreviousLevels/showNextLevels`;
- timeline recebe todos os `snapshot.levels`;
- `NÍVEL ATUAL` usa referência/scroll;
- reward não possui borda estrutural permanente;
- mobile usa eixo vertical;
- desktop usa eixo horizontal;
- reduced motion preservado.

### Existing behavior

Preservar testes de:

- claim individual;
- claim group;
- claim-all;
- compra Elite;
- dialog/reveal;
- states locked/premium_locked/claimable/claimed;
- reward assets.

### Visual/manual

Comparar:

- Home estável;
- clique Campanha;
- primeiro frame Campaign;
- Campaign assentada;
- scroll desktop;
- scroll mobile;
- nível atual;
- nível 100;
- free only;
- Elite ativa;
- claimable;
- claimed;
- reduced motion.

## 21. Fora de escopo

Não alterar:

- distribuição de rewards;
- XP;
- preços;
- Season 1;
- contratos de snapshot;
- services/repositories;
- Economy V2;
- catálogo;
- banco;
- migrations;
- asset identities;
- lógica de claim;
- lógica de purchase.

## 22. Critério de conclusão

O redesign está concluído quando:

1. os 100 níveis pertencem a uma única timeline contínua;
2. desktop possui scroll horizontal com Elite acima e Livre abaixo;
3. mobile possui scroll vertical com Elite à esquerda e Livre à direita;
4. cards e borders estruturais foram removidos;
5. nível atual pode ser localizado diretamente;
6. claims e purchase mantêm o comportamento autoritativo existente;
7. Campaign usa a Pre-game Foundation e mantém o fundo da Home;
8. Home → Campaign possui continuidade visual semelhante à navegação Home → Operações;
9. nenhum Canvas/background 3D duplicado é criado;
10. keyboard, foco, reduced motion e aria-live permanecem corretos;
11. não existe overflow horizontal acidental no mobile;
12. a experiência preserva a identidade visual do Bellum Civile.

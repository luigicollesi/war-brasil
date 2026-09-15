# Territory Skins — EVAL v1

Status: **reconciliado com Economy/Storefront V2**

Companion SPEC: `docs/economy/territory-skins/SPEC.md`

## 1. Política

Todo gate marcado BLOCKER deve passar.

Os testes econômicos compartilhados permanecem em `docs/economy/EVAL.md` e os detalhes comerciais da loja em `docs/economy/store/EVAL.md`.

O slot canônico é `territory_skin`. `territory_effect` pode aparecer somente em contexto histórico/migration legado, não como contrato runtime novo.

## 2. Matriz mínima

Visual/manual:

```text
Desktop 1440x900
Mobile 390x844
prefers-reduced-motion: reduce
prefers-reduced-motion: no-preference
```

Renderer territorial:

```text
forest
ocean
sun
ruby
violet
orange
```

## 3. Dados e constraints

### TSKIN-DATA-001 — slot canônico
**BLOCKER — automated/database**

Todos os acabamentos territoriais atuais usam `slot='territory_skin'`.

### TSKIN-DATA-002 — procedural/image exclusivos
**BLOCKER — database integration**

Para `territory_skin`:

- `effect_key != NULL` + `asset_ref != NULL` é rejeitado;
- ambos NULL são rejeitados;
- procedural válido é aceito;
- image válido é aceito.

### TSKIN-DATA-003 — dados continuam válidos
**BLOCKER — migration integration**

Constraints de skin não invalidam `dice_attack`, `dice_defense` ou `dice_neutral`.

### TSKIN-DATA-004 — default
**BLOCKER — automated**

Existe exatamente um default territorial, procedural, `effect_key=default`, gratuito/disponível e independente de WebP.

### TSKIN-DATA-005 — quatro image skins V1
**BLOCKER — migration integration**

As quatro object keys abaixo permanecem exatas:

```text
cosmetics/territory-skins/azulejo_brasil.webp
cosmetics/territory-skins/azulejo_ornamental.webp
cosmetics/territory-skins/ceu_estrelado.webp
cosmetics/territory-skins/solar_ornamental.webp
```

## 4. R2 e delivery

### TSKIN-R2-001 — namespace
**BLOCKER — automated**

Key fora de `cosmetics/territory-skins/` ou não-WebP é rejeitada.

### TSKIN-R2-002 — object key persistente
**BLOCKER — source/database**

Catálogo/snapshot persistem `asset_ref` canônica, não presigned URL.

### TSKIN-R2-003 — exact-key delivery
**integration**

Cada WebP pode ser resolvido por delivery oficial sem `ListObjects`.

### TSKIN-R2-004 — catálogo data-driven
**BLOCKER — structural/integration**

Nova skin válida pode aparecer no catálogo/store sem novo branch React por slug.

### TSKIN-R2-005 — fallback
**BLOCKER — automated/browser**

Objeto ausente resulta em fallback visual seguro, sem crash ou mutação econômica.

## 5. Compra e ownership

### TSKIN-BUY-001 — oferta ativa
**BLOCKER — integration**

Uma `territory_skin` com product/offer ativo aparece como comprável usando preço server-derived.

### TSKIN-BUY-002 — compra atômica
**BLOCKER — database integration**

Compra bem-sucedida:

- debita wallet/ledger;
- cria receipt/item snapshot;
- concede ownership individual de `territory_skin`;
- usa o mesmo purchase pipeline dos demais cosméticos.

### TSKIN-BUY-003 — não equipa implicitamente
**BLOCKER — integration**

Comprar skin não muda automaticamente `profile.cosmetic_loadout.territory_skin`.

### TSKIN-BUY-004 — falhas
**BLOCKER — integration**

Saldo insuficiente, oferta expirada/desabilitada, already-owned, idempotência e falha transacional não deixam débito/grant parcial.

### TSKIN-BUY-005 — catálogo sem oferta
**BLOCKER — UI/integration**

Skin catalogada sem offer ativa pode ser descoberta, mas não recebe preço/CTA inventado pelo cliente.

## 6. Arsenal/equipagem

### TSKIN-EQUIP-001 — bay TERRITÓRIO
**BLOCKER — visual/integration**

Arsenal possui bay `TERRITÓRIO` refletindo `territory_skin` equipada.

### TSKIN-EQUIP-002 — owned-only
**BLOCKER — integration**

Seletor oferece default + skins possuídas, não itens não adquiridos.

### TSKIN-EQUIP-003 — autorização
**BLOCKER — server integration**

Equipar skin válida não possuída é rejeitado e não muda loadout.

### TSKIN-EQUIP-004 — persistência
**BLOCKER — browser integration**

Equipagem persiste após reload.

### TSKIN-EQUIP-005 — retorno ao default
**integration**

Reequipar default mantém a image skin no inventário.

## 7. Snapshot de partida

### TSKIN-SNAPSHOT-001 — congelamento
**BLOCKER — server/database integration**

Partida congela identidade estável e `asset_ref`/`effect_key` da skin equipada.

### TSKIN-SNAPSHOT-002 — procedural
**BLOCKER — integration**

Default funciona sem URL remota.

### TSKIN-SNAPSHOT-003 — perfil posterior não altera partida
**BLOCKER — integration**

Trocar loadout após início não muda snapshot da partida em andamento.

### TSKIN-SNAPSHOT-004 — reconnect
**integration**

Reconnect renova delivery a partir de `asset_ref` sem mudar identidade.

## 8. Renderer e gameplay

### TSKIN-RENDER-001 — WebP na superfície
**BLOCKER — visual/integration**

Cada image skin aparece restrita à face territorial.

### TSKIN-RENDER-002 — seis cores
**BLOCKER — visual matrix**

A mesma skin mantém ownership distinguível em:

```text
forest
ocean
sun
ruby
violet
orange
```

### TSKIN-RENDER-003 — hitbox invariável
**BLOCKER — automated/browser**

Aplicar skin não muda geometria/hit target e camada cosmética não captura pointer.

### TSKIN-RENDER-004 — arquitetura compartilhada
**BLOCKER — structural**

Não existe componente React independente por cada um dos 42 territórios apenas para trocar textura.

### TSKIN-RENDER-005 — estados prevalecem
**BLOCKER — visual matrix**

Verificar pelo menos:

```text
normal
hover
highlighted
highlighted-hover
selected
target selectable
target blocked
```

Seleção/targetability continuam mais fortes que a textura.

### TSKIN-RENDER-006 — tropas/markers legíveis
**BLOCKER — visual**

Tropas e HUD funcional permanecem legíveis em skin clara, escura e detalhada.

### TSKIN-RENDER-007 — conquista
**BLOCKER — browser/integration**

Após conquista, território passa a usar a skin congelada do novo proprietário sem nova consulta econômica.

## 9. Procedurais e fallback

### TSKIN-PROC-001 — registry seguro
**BLOCKER — structural**

`effect_key` é resolvida por código seguro, sem CSS/JS/shader arbitrário do banco.

### TSKIN-PROC-002 — chave desconhecida
**BLOCKER — automated**

Chave desconhecida degrada para default sem alterar ownership/loadout/snapshot.

### TSKIN-FALLBACK-001 — image failure
**BLOCKER — browser/automated**

Falha de imagem degrada para acabamento default.

### TSKIN-FALLBACK-002 — fallback não persiste mutação
**BLOCKER — integration**

Fallback não reequip, remove ownership, altera ledger, snapshot ou gameplay.

## 10. Cache/performance

### TSKIN-PERF-001 — reutilização
**BLOCKER — structural/network**

Mesmo `asset_ref` é reutilizado; não há um download independente por território.

### TSKIN-PERF-002 — assinatura estável
**BLOCKER — structural**

Invalidação visual usa identidade estável baseada em owner/cosmetic/mode, não presigned URL como única chave.

### TSKIN-PERF-003 — updates incrementais
**BLOCKER — structural/performance**

Mudança irrelevante não recria material/texture registry para os 42 territórios.

## 11. Compatibilidade

### TSKIN-COMPAT-001 — geometria
**BLOCKER**

42 territórios, paths e fronteiras canônicas continuam inalterados.

### TSKIN-COMPAT-002 — interação
**BLOCKER**

Pointer/keyboard/hover/selection continuam funcionais.

### TSKIN-COMPAT-003 — usuários/partidas antigas
**BLOCKER**

Descriptor ausente/inválido degrada para default.

## 12. Definition of Done

Territory skins estão prontas somente quando:

1. slot runtime é `territory_skin`;
2. migration/catalog/ownership/loadout estão coerentes;
3. quatro skins V1 podem ser entregues por exact key;
4. compra de skin usa o pipeline Economy V2 e não equipa automaticamente;
5. snapshot congela skin corretamente;
6. renderer mantém os seis PlayerColors e estados funcionais legíveis;
7. hitbox/gameplay permanecem invariáveis;
8. fallback/cache/performance passam;
9. matriz desktop/mobile/reduced-motion e seis cores tem evidência;
10. Economy EVAL e Store EVAL relacionados permanecem verdes.

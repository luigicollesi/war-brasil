# Plano técnico — PROFILE V4 / Quartel do Comandante

Branch: `feature/profile-v4-implementation`  
Contratos: `SPEC.md` + `EVAL.md`

## Objetivo

Implementar PROFILE V4 como três superfícies privadas orientadas por rota — Dossiê, Arsenal e Intendência — preservando autenticação, social, histórico, privacidade, Foundation e as fronteiras autoritativas do domínio Economy.

A implementação é incremental e TDD-first. Nenhuma etapa deste branch deve inventar regras financeiras ausentes do Economy V2.

## Restrições

- `/profile` = Dossiê.
- `/profile/arsenal` = Arsenal.
- `/profile/store` = Intendência.
- `/profile/[handle]` permanece perfil público e não recebe o shell privado.
- nenhuma imagem/avatar/retrato de perfil.
- `/coin.svg` é o ícone canônico de `campaign-credit`.
- saldo indisponível nunca vira `0` fictício.
- componentes de Profile não executam SQL.
- Economy continua autoridade de wallet, catálogo, ownership, loadout, offers, prices e purchases.
- enquanto Economy V2 não expuser offers/purchases/credit packs no runtime, a UI não cria preços, saldo, compra ou checkout fictícios.

## Estratégia de testes

1. Antes de cada slice, adicionar/ajustar testes que expressem os gates do EVAL.
2. Preferir testes puros de apresentação/contrato em `src/lib/profile/` quando possível.
3. Usar `tests/*.test.mjs` para invariantes de source/rotas quando o repositório não possui harness React/DOM.
4. Validar com `npm run test:compile`, `npm run test:run`, `npm run lint` e, ao final, `npm run build` quando o ambiente permitir.
5. E2E/browser que exijam servidor ficam como evidência manual/CI específica; nunca iniciar `dev` apenas para validar.

## Fase 0 — Baseline e rastreabilidade

### Entregas

- substituir este plano V3 pelo plano V4;
- mapear cada etapa aos gates `PRO4-*`;
- registrar dependências externas de Economy V2 sem implementá-las neste branch.

### Gate

O branch deve continuar isolado de `dev` e nenhum código de Economy V2 comercial deve ser inventado aqui.

## Fase 1 — ProfileShell compartilhado

### Teste primeiro

Adicionar teste de contrato cobrindo:

- três links primários: `/profile`, `/profile/arsenal`, `/profile/store`;
- identificação semântica da superfície ativa;
- wallet com `/coin.svg` quando disponível;
- estado textual de indisponibilidade sem saldo `0` sintético;
- ausência de `Mesa de Comando Pessoal` e `Identidade em foco` no V4.

### Implementação

Criar:

- `src/components/profile/v4/profile-shell.tsx`;
- `src/components/profile/v4/profile-shell.module.css`;
- `src/lib/profile/profile-v4-presentation.ts` para regras puras de navegação/wallet/labels quando útil.

O shell recebe somente dados já resolvidos no servidor e não conhece SQL nem R2 para a moeda.

Gates principais: `PRO4-ARCH-01..07`, `PRO4-SHELL-01..09`, `PRO4-IMG-*` aplicáveis.

## Fase 2 — Dossiê V4

### Teste primeiro

Cobrir:

- nome, handle, título, bio, presença e atividade;
- identidade sem avatar;
- `Ajustar Dossiê` integrado à composição;
- social e histórico como módulos secundários;
- degradação econômica sem derrubar identidade/social/histórico.

### Implementação

Criar:

- `src/components/profile/v4/profile-dossier.tsx`;
- `src/components/profile/v4/profile-dossier.module.css`.

Reutilizar:

- `ProfileSettingsPanel` e endpoints atuais;
- `ProfileNetworkStation` e operações sociais atuais;
- `ProfileCampaignStation` e histórico atual;
- `getCurrentProfileCommandSnapshot()`.

Atualizar `src/app/profile/page.tsx` para renderizar apenas o Dossiê V4 dentro do shell.

Remover do caminho privado principal o uso de `ProfileCommandHub`; não é necessário deletar legado no primeiro slice se ainda houver referências de avaliação/compatibilidade.

Gates principais: `PRO4-DOS-01..08`, `PRO3-ID-*`, `PRO3-SOC-*`, `PRO3-PRES-*`, `PRO3-ACT-*`, `PRO3-HIST-*`.

## Fase 3 — Arsenal V4

### Teste primeiro

Cobrir:

- rota autenticada `/profile/arsenal`;
- exatamente quatro bays: Ataque, Defesa, Neutro, Território;
- somente `ownedItems` no inventário principal;
- filtros Todos/Ataque/Defesa/Neutro/Território;
- item não possuído nunca recebe `EQUIPAR`;
- equipagem usa somente `/api/economy/loadout` e persiste via backend.

### Implementação

Criar:

- `src/app/profile/arsenal/page.tsx`;
- `src/components/profile/v4/profile-arsenal.tsx`;
- `src/components/profile/v4/profile-arsenal.module.css`.

Extrair a lógica de equipagem hoje acoplada a `EconomyStorefront` para uma fronteira reutilizável, sem alterar regra Economy.

Gates principais: `PRO4-ARS-01..12`.

## Fase 4 — Intendência V4 sobre runtime disponível

### Teste primeiro

Cobrir o que o runtime Economy atual consegue garantir:

- rota autenticada;
- shell e wallet canônica;
- catálogo vindo do snapshot real;
- previews reais/fallback;
- ausência de preços/checkout inventados quando o backend não os fornece.

### Implementação

Refatorar:

- `src/app/profile/store/page.tsx`;
- `src/components/profile/store/economy-storefront.tsx` ou substituir por componentes `v4/`.

O layout deve estar pronto para receber hero/offers/inspection/credit packs de Economy V2, porém qualquer CTA comercial fica derivado exclusivamente do DTO real.

### Dependência externa explícita

Os gates que exigem `offers`, `price`, purchase real e `credit_packs` só podem ficar verdes após Economy V2 runtime existir. Este branch prepara integração; não cria dados comerciais hardcoded.

Gates principais: `PRO4-STORE-*`, `PRO4-BUY-*`, `PRO4-CASH-*`, respeitando blockers externos.

## Fase 5 — Responsividade, motion e Foundation

### Implementação

- desktop alvo `1440x900`;
- mobile alvo `390x844`;
- navegação sem dependência de hover;
- focus visível;
- `prefers-reduced-motion` remove float/parallax/sweeps;
- animações apenas transform/opacity quando possível;
- manter Foundation através da API pública existente, sem importar Three/R3F nos componentes Profile.

Gates principais: `PRO4-FOUND-*`, `PRO4-VIS-*`, `PRO4-MOTION-*`, `PRO4-RESP-*`.

## Fase 6 — Failure states e integração final

Cobrir:

- sessão ausente;
- identidade ausente;
- wallet indisponível;
- catálogo indisponível;
- asset indisponível;
- falha ao equipar;
- back/forward entre as três rotas.

Gates principais: `PRO4-DATA-*` e cenários `PRO4-S*` correspondentes.

## Fase 7 — Verificação final

Executar, quando disponível:

```bash
npm run test:compile
npm run test:run
npm run lint
npm run build
```

Também produzir matriz final dos blockers do `EVAL.md`:

- verde: implementado + evidência;
- bloqueado externamente: depende de Economy V2 ainda inexistente no runtime;
- manual: depende de browser/viewport e não foi automatizado.

PROFILE V4 só é considerado integralmente aprovado quando todos os BLOCKERs aplicáveis estiverem verdes e o domínio Economy necessário também estiver implementado.

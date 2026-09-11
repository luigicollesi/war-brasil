# Operations EVAL Evidence Runbook

Branch alvo: `feature/pre-game-operations`

Este roteiro existe para transformar `EVAL.md` em evidência reproduzível. Um cenário só pode ser marcado como aprovado depois de ser executado no commit/preview indicado.

## Ambiente base

- rota: `/matchmaking`;
- desktop: `1440x900`;
- mobile: `390x844`;
- mobile com teclado: manter largura 390 e reduzir a altura útil até aproximadamente 640 px;
- reduced motion: `prefers-reduced-motion: reduce`;
- fallback: WebGL indisponível/desabilitado;
- registrar commit, URL do preview e navegador usado.

## OPS-S1 — criar sala

Gates: OPS-01, OPS-08.

1. Abrir `/matchmaking` em `Nova operação`.
2. Acionar `Autorizar nova operação`.
3. Confirmar estado textual de criação e CTA indisponível enquanto o request está ativo.
4. Confirmar navegação para `/lobby/<codigo retornado>`.
5. Repetir com double-click rápido e confirmar somente uma criação efetiva.

Evidência: URL final + Network panel mostrando uma única operação ativa por tentativa.

## OPS-S2 — entrar por código digitado

Gates: OPS-02, OPS-09.

1. Criar/obter uma sala válida em espera.
2. Selecionar `Localizar operação`.
3. Digitar o código manualmente, incluindo letras maiúsculas.
4. Enviar.
5. Confirmar navegação para o lobby da mesma sala.

Evidência: código original, request `/api/rooms/join` e URL final.

## OPS-S3 — colar código completo

Gate: OPS-05.

1. Copiar um código válido completo.
2. Focar o único campo `Código da operação`.
3. Colar com teclado/context menu.
4. Selecionar parte do texto e substituir um caractere.
5. Desfazer/corrigir e enviar.

Aprova se paste, seleção e edição funcionarem como em um input nativo, sem salto de foco entre caracteres.

## OPS-S4 — código inválido e correção

Gates: OPS-03, OPS-10.

1. Informar código inexistente/inválido.
2. Enviar.
3. Confirmar erro textual associado ao input e estado `invalid-code`.
4. Confirmar que o valor digitado continua no campo.
5. Corrigir sem reload.
6. Reenviar e entrar normalmente.

## OPS-S5 — falha de rede / timeout e retry

Gate: OPS-04.

### Variante A — falha de rede

1. Com a página já carregada, bloquear `/api/rooms` ou `/api/rooms/join` no DevTools.
2. Disparar a ação.
3. Confirmar mensagem textual de comunicação interrompida.
4. Confirmar que CTA/input deixam o estado busy e permitem nova tentativa.
5. Remover o bloqueio e repetir com sucesso.

### Variante B — timeout

A cobertura automatizada usa `fetchOperationsRequest` com fetcher injetável e timeout reduzido somente no teste. O timeout de produção permanece em 15 s.

## OPS-S6 — submissão repetida

Gate: OPS-08.

1. Abrir Network panel preservando requests.
2. Fazer double-click rápido em Create.
3. Confirmar um único POST ativo.
4. Repetir Join pressionando Enter e clicando no CTA quase simultaneamente.
5. Confirmar um único POST ativo.

## OPS-S7 — alternar modos preservando estado

Gate: OPS-10.

1. Selecionar Join e digitar um código parcial.
2. Trocar para Create.
3. Voltar para Join.
4. Confirmar que o valor permanece intacto.
5. Confirmar que o painel inativo não fica exposto à navegação normal.

## OPS-S8 — reduced motion

Gate: OPS-06.

1. Ativar `prefers-reduced-motion: reduce` antes de carregar a página.
2. Verificar `idle`, foco, criação/join pending e erro.
3. Confirmar ausência de loops/transforms ornamentais essenciais.
4. Confirmar que conteúdo, foco, requests, erros e navegação permanecem equivalentes.

Capturas: desktop e mobile.

## OPS-S9 — WebGL indisponível

Gate: OPS-06.

Antes da integração Foundation, Operations deve continuar totalmente funcional em sua composição DOM/2D. Após Foundation entrar em `dev`, repetir este cenário usando o fallback oficial do `CommandShell`.

Aprova se Create/Join, status, erro, teclado e navegação continuarem funcionando sem Canvas/WebGL.

## OPS-S10 — mobile 390x844 com teclado

Gates: OPS-05, OPS-10, OPS-12.

1. Abrir em `390x844`.
2. Selecionar Join e abrir o teclado no input.
3. Confirmar que o input e CTA permanecem alcançáveis por scroll normal.
4. Confirmar que a área cenográfica reduz altura em viewport útil baixo e não comprime os controles.
5. Executar paste, erro e retry.
6. Repetir Create por touch.

## Capturas obrigatórias

Capturar em `1440x900` e `390x844`:

- `idle`;
- `create-focus`;
- `creating`;
- `typing-code`;
- `invalid-code`;
- `network-error`;
- `reduced-motion`;
- `fallback`.

Toda captura deve registrar commit e estado. Não usar uma única imagem como evidência de múltiplos estados.

## Checklist de fechamento

Antes de considerar Operations aprovada:

- [ ] OPS-S1 executado;
- [ ] OPS-S2 executado;
- [ ] OPS-S3 executado;
- [ ] OPS-S4 executado;
- [ ] OPS-S5 executado;
- [ ] OPS-S6 executado;
- [ ] OPS-S7 executado;
- [ ] OPS-S8 executado;
- [ ] OPS-S9 executado após integração Foundation;
- [ ] OPS-S10 executado;
- [ ] screenshots desktop/mobile anexadas ao PR;
- [ ] `npm test` verde;
- [ ] `npm run lint` verde;
- [ ] `npm run build` verde;
- [ ] diff final sem mudanças não especificadas em API/realtime/banco;
- [ ] score Operations >= 85;
- [ ] OPS-01..OPS-12 aprovados.

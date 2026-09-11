# Pre-game Command Experience

Este diretório é a fonte de verdade do redesign pré-jogo do WAR Brasil.

## Objetivo

Substituir a identidade visual herdada de WAR por uma linguagem própria: **Guerra Cerimonial Brasileira**, combinando autoridade militar, prestígio, monumentalidade e tecnologia física.

O pré-jogo MUST parecer um **ritual de comando**, não um site com tema militar, dashboard SaaS ou menu sci-fi genérico.

Princípio de produto:

> O jogador não abre um menu. Ele recebe autoridade sobre um teatro de operações.

## Escopo

| Área | Rota | Estado atual | Spec | Eval |
| --- | --- | --- | --- | --- |
| Entrada / Home | `/` | existe | `home/SPEC.md` | `home/EVAL.md` |
| Operações | `/matchmaking` | existe | `operations/SPEC.md` | `operations/EVAL.md` |
| Lobby | `/lobby/[code]` | existe | `lobby/SPEC.md` | `lobby/EVAL.md` |
| Doutrina / Regras | `/rules` | nova; guia hoje está na Home | `doctrine/SPEC.md` | `doctrine/EVAL.md` |
| Perfil / Salão de Comando | `/profile` | nova | `profile/SPEC.md` | `profile/EVAL.md` |

A infraestrutura compartilhada fica em `foundation/`.

## Documentos normativos

1. `quality-standard.md` — interpretação de MUST/SHOULD/MAY, evidências e Definition of Done comum.
2. `traceability.md` — matriz que impede omissão das ideias centrais do redesign.
3. `visual-language.md` — identidade, materiais, cor, objetos de assinatura e motion.
4. `parallel-development.md` — ownership e fronteiras para implementação simultânea.
5. `foundation/SPEC.md` + `foundation/EVAL.md` — contrato da cena compartilhada.
6. `SPEC.md` + `EVAL.md` da trilha em desenvolvimento.
7. `manifest.json` — índice machine-readable para agentes.

As palavras normativas em maiúsculas seguem BCP 14 conforme `quality-standard.md`.

## Regra de completude

Uma trilha só está concluída quando:

- todos os gates `BLOCKER` passam;
- score >= 85/100;
- todos os conceitos `CORE` aplicáveis em `traceability.md` continuam representados;
- `npm test`, `npm run lint` e `npm run build` permanecem verdes;
- desktop e mobile foram verificados;
- teclado/touch foram verificados quando aplicável;
- `prefers-reduced-motion` possui comportamento equivalente e funcional;
- falha/ausência de WebGL não impede conteúdo ou ação principal;
- o PR fornece evidência reproduzível para os critérios avaliados.

## Contratos que o redesign não pode alterar silenciosamente

O trabalho pré-jogo MUST NOT mudar, sem spec separado:

- regras do jogo;
- geometria/fronteiras canônicas do mapa;
- criação/entrada em salas;
- protocolo realtime;
- schema ou semântica de banco;
- condições de ready/início da partida;
- significado dos dados exibidos no perfil.

## Stack

Não adicionar outra stack de renderização sem necessidade explícita. O projeto já possui Next.js, React, Tailwind CSS, Three.js e React Three Fiber.

A cena 3D SHOULD ser compartilhada e persistente quando a arquitetura permitir. Páginas solicitam **intenção de cena**; não controlam diretamente câmera, luz, renderer ou internals Three.js.

O conteúdo crítico da rota MUST existir independentemente do 3D. WebGL é progressive enhancement.

## Regra contra omissão

Qualquer remoção ou substituição de uma ideia marcada `CORE` em `traceability.md` MUST aparecer explicitamente no PR com justificativa e atualização da matriz. Ausência silenciosa é falha de implementação, mesmo que CI e score estejam verdes.

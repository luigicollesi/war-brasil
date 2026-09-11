# Pre-game Command Experience

Este diretório é a fonte de verdade para a nova experiência pré-jogo do WAR Brasil.

## Objetivo

Substituir a identidade visual herdada de WAR por uma linguagem própria: **guerra cerimonial brasileira**, combinando autoridade militar, prestígio, monumentalidade e tecnologia física.

O pré-jogo deve parecer um **ritual de comando**, não um site com tema militar.

## Rotas-alvo

| Área | Rota | Estado atual | Spec | Eval |
| --- | --- | --- | --- | --- |
| Entrada / Home | `/` | existe | `home/SPEC.md` | `home/EVAL.md` |
| Operações | `/matchmaking` | existe | `operations/SPEC.md` | `operations/EVAL.md` |
| Lobby | `/lobby/[code]` | existe | `lobby/SPEC.md` | `lobby/EVAL.md` |
| Doutrina / Regras | `/rules` | nova; hoje o guia está na Home | `doctrine/SPEC.md` | `doctrine/EVAL.md` |
| Perfil / Salão de Comando | `/profile` | nova | `profile/SPEC.md` | `profile/EVAL.md` |

A infraestrutura compartilhada está em `foundation/`.

## Ordem de leitura para qualquer agente

1. `visual-language.md`
2. `parallel-development.md`
3. `foundation/SPEC.md`
4. o `SPEC.md` da própria página
5. o `EVAL.md` da própria página

## Regra de desenvolvimento

Uma página só está concluída quando:

- todos os gates `BLOCKER` do respectivo `EVAL.md` passam;
- o score de qualidade é >= 85/100;
- `npm test`, `npm run lint` e `npm run build` permanecem verdes;
- desktop e mobile foram verificados;
- `prefers-reduced-motion` possui comportamento funcional;
- a página não reintroduz identidade visual clássica do WAR nem sci-fi ciano genérico.

## Stack já disponível

Não adicionar outra stack de renderização sem necessidade. O projeto já possui Next.js, React, Tailwind CSS, Three.js e React Three Fiber.

A cena 3D deve ser compartilhada e persistente entre as páginas do pré-jogo quando a arquitetura permitir. Páginas solicitam **intenção de cena**; não controlam diretamente câmera, luz ou renderer.

## Princípio de produto

> O jogador não abre um menu. Ele recebe autoridade sobre um teatro de operações.

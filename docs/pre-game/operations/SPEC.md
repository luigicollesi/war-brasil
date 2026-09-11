# SPEC — Operações

**Rota:** `/matchmaking`  
**Cena:** `operations`

## Fantasia

A Mesa deixa de ser símbolo e torna-se máquina. Entrar em matchmaking significa **autorizar ou localizar uma operação militar**.

## Contratos funcionais preservados

Reutilizar o comportamento já existente de `CreateRoomButton` e `JoinRoomForm` ou seus contratos equivalentes. O redesign não pode alterar silenciosamente criação de sala, formato aceito de código, erros ou navegação resultante.

## Ações

### Nova Operação

Cria uma nova sala. Visualmente, a Mesa destrava e pode gerar uma placa/selo de operação.

### Localizar Operação

Recebe o código existente. O input pode ser apresentado como cifrador de caracteres, mas deve continuar sendo um campo acessível, colável e compatível com teclado/autofill quando pertinente.

## Layout

Evitar dois cards SaaS lado a lado. As duas ações devem parecer **dois modos da mesma máquina**.

O Brasil pode separar placas alguns milímetros; a Coroa Orbital alinha-se parcialmente; linhas vermelhas surgem apenas durante o estado de operação.

## Estados

`idle`, `create-focus`, `creating`, `create-error`, `join-focus`, `typing-code`, `joining`, `invalid-code`, `network-error`, `reduced-motion`.

Todos os estados assíncronos têm feedback textual; motion não substitui status.

## Mobile

O cifrador visual não cria seis inputs independentes se isso prejudicar colar código, acessibilidade ou teclado. Pode haver um único input semanticamente correto com representação visual segmentada.

## Não fazer

- mudar endpoints ou protocolo de salas por causa do redesign;
- esconder erro dentro da cena 3D;
- usar animação longa antes do redirect ao lobby;
- bloquear criação por asset 3D não carregado;
- transformar create/join em dois cards genéricos.

## Definition of Done

Create/join preservam comportamento existente, a página parece uma estação de autorização e passa `operations/EVAL.md`.

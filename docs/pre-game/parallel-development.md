# Parallel Development Contract

## Meta

Permitir desenvolvimento simultâneo das páginas sem múltiplas implementações concorrentes da cena 3D, tokens, câmera ou contratos de multiplayer.

## Trilhas

- `foundation`: CommandShell, cena persistente, tokens, primitives, CameraDirector e contratos.
- `home`: entrada e ritual inicial.
- `operations`: criar/localizar operação.
- `lobby`: briefing e prontidão multiplayer.
- `doctrine`: regras/tutoriais interativos.
- `profile`: Salão de Comando e progresso.

## Fronteira obrigatória

As páginas **não** devem importar ou manipular diretamente objetos internos Three.js da fundação. Elas emitem uma intenção declarativa.

Contrato conceitual:

```ts
type CommandSceneMode =
  | "entrance"
  | "operations"
  | "lobby"
  | "doctrine"
  | "profile";

type CommandSceneIntent = {
  mode: CommandSceneMode;
  focus?: "earth" | "brazil" | "table" | "insignia" | "none";
  conflictLevel?: 0 | 1 | 2 | 3;
  territoryExplode?: number;
  orbitalAlignment?: 0 | 1;
};
```

O shape final pode mudar na implementação da fundação, mas precisa permanecer pequeno, declarativo e estável.

## Regras de ownership

Uma trilha de página pode editar sua rota e componentes próprios. Mudanças em `CommandShell`, cena 3D, tokens globais ou contratos compartilhados pertencem à trilha `foundation`.

Se uma página precisar de novo comportamento compartilhado, deve fazê-lo por uma extensão mínima do contrato, não acessando internals.

## Contratos funcionais preservados

- `/matchmaking` continua criando sala e aceitando código existente.
- `/lobby/[code]` continua usando o código da sala e preserva sincronização/ready atuais.
- a nova identidade não altera regras de jogo, protocolo realtime ou banco sem spec separado.

## Estratégia de integração

1. Congelar o contrato público da `foundation`.
2. As cinco páginas podem avançar em paralelo usando stubs/mocks desse contrato.
3. Integrar `foundation` primeiro.
4. Integrar páginas individualmente, cada uma passando seu eval.
5. Rodar uma avaliação cruzada de transições depois das integrações.

## Evitar conflitos

- não mover rotas durante desenvolvimento paralelo;
- não renomear componentes compartilhados por estética;
- não reformatar arquivos não relacionados;
- não alterar APIs/realtime para resolver problemas puramente visuais;
- não adicionar biblioteca de animação, UI kit ou segundo renderer sem decisão explícita.

## Evidência mínima de PR

Cada PR de página deve trazer:

- referência ao spec e IDs dos evals atendidos;
- screenshots desktop e mobile dos estados principais;
- lista dos arquivos compartilhados tocados, idealmente vazia;
- resultado de testes/lint/build;
- regressões conhecidas explicitadas.

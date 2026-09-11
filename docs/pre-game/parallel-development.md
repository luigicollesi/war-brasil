# Parallel Development Contract

## Meta

Permitir desenvolvimento simultâneo sem criar múltiplas implementações concorrentes da cena 3D, câmera, tokens, geometria territorial ou contratos multiplayer.

Toda trilha MUST ler `quality-standard.md` e `traceability.md` antes de implementar.

## Trilhas

- `foundation`: CommandShell, cena persistente, Terra/Globo, Mesa, Brasil 42 placas, Coroa Orbital, tokens, primitives, CameraDirector e contratos.
- `home`: entrada e ritual inicial.
- `operations`: criar/localizar operação.
- `lobby`: briefing e prontidão multiplayer.
- `doctrine`: regras/tutoriais interativos.
- `profile`: Salão de Comando e progresso.

## Fronteira obrigatória

As páginas MUST NOT importar/manipular diretamente objetos internos Three.js da fundação. Elas emitem intenção declarativa.

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

O shape final MAY mudar durante a Foundation, mas a API pública MUST continuar pequena, declarativa, serializável quando possível e independente de coordenadas/câmera/material.

## Ownership

Uma trilha de página pode editar sua rota, componentes e estilos locais.

Pertencem à `foundation`:

- `CommandShell`/scene host;
- renderer/Canvas;
- CameraDirector;
- geometria/apresentação compartilhada do Brasil;
- Terra/Globo, Mesa e Coroa Orbital;
- tokens globais e primitives compartilhadas;
- contrato público de scene intent.

Se uma página precisar de comportamento compartilhado, SHOULD solicitar extensão mínima do contrato. MUST NOT acessar internals para “ganhar velocidade”.

## Contratos funcionais preservados

- `/matchmaking` continua criando sala e aceitando código existente;
- `/lobby/[code]` continua usando o código e sincronização/ready atuais;
- geometria/fronteiras e identidade dos 42 territórios continuam canônicas;
- a nova identidade não altera regra de jogo, protocolo realtime, banco ou autenticação sem spec separado.

## Desenvolvimento contra mocks

Depois que o contrato público da Foundation for congelado, as páginas MAY usar um mock visual simples que aceite `CommandSceneIntent`.

O mock MUST:

- não introduzir uma segunda API;
- não ser mergeado como implementação definitiva da cena;
- permitir testar navegação, layout, estados e acessibilidade sem bloquear a trilha pela entrega do 3D.

## Estratégia de integração

1. congelar contrato público mínimo da `foundation`;
2. publicar tipos/stubs necessários;
3. páginas avançam em paralelo contra o contrato;
4. integrar `foundation` primeiro;
5. integrar cada página separadamente, passando seus evals;
6. executar avaliação cruzada de transições e regressões;
7. validar a matriz `traceability.md` após todas as integrações.

## Evitar conflitos

MUST NOT:

- mover rotas durante desenvolvimento paralelo;
- renomear componentes compartilhados por estética;
- reformatar arquivos não relacionados;
- alterar APIs/realtime para resolver problema visual;
- adicionar UI kit, animation library ou segundo renderer sem decisão explícita;
- duplicar geometria territorial “parecida” para uma página;
- criar scene state que replique estado de negócio.

## Dependências entre trilhas

`foundation-contract` é dependência de interface, não de implementação completa. Home/Operations/Lobby/Doctrine/Profile SHOULD conseguir avançar após os tipos/contratos mínimos estarem estáveis.

Mudança breaking no contrato compartilhado MUST:

1. ser explicitada no PR da Foundation;
2. atualizar `manifest.json`/docs quando necessário;
3. identificar trilhas impactadas;
4. evitar merge até consumidores ativos estarem reconciliados.

## Evidência mínima de PR

Cada PR de página MUST trazer:

- referência ao spec e IDs dos evals atendidos;
- referência aos conceitos `CORE` aplicáveis de `traceability.md`;
- screenshots desktop/mobile dos estados principais;
- lista de arquivos compartilhados tocados, idealmente vazia;
- resultado de testes/lint/build;
- justificativa para qualquer `SHOULD` não seguido;
- regressões conhecidas explicitadas;
- confirmação de que não alterou contratos fora do escopo.

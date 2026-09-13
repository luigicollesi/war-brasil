# Parallel Development Contract

## Meta

Permitir desenvolvimento simultâneo sem criar múltiplas implementações concorrentes da cena 3D, câmera, tokens, geometria territorial, runtime de opening ou contratos multiplayer.

Toda trilha MUST ler `quality-standard.md` e `traceability.md` antes de implementar. Trilhas com abertura/transição complexa MUST ler também `opening-animation-standard.md`.

## Trilhas

- `foundation`: CommandShell, cena persistente, Terra/Globo, Mesa, Brasil 42 placas, Coroa Orbital, tokens, primitives, CameraDirector, runtime mínimo de opening e contratos.
- `home`: entrada, Genesis cartográfica e ritual inicial.
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
  opening?: {
    id: string;
    lifecycle: "loading" | "primed" | "playing" | "settling" | "settled";
  };
};
```

O shape final MAY mudar durante a Foundation. O exemplo acima não congela nomes de campos; congela responsabilidades: a API pública MUST continuar pequena, declarativa, serializável quando possível e independente de coordenadas/câmera/material/progresso por frame.

`progress` por frame MUST NOT atravessar React/scene intent. O runtime de opening e os adaptadores da cena compartilham refs/controladores internos.

## Ownership

Uma trilha de página pode editar sua rota, componentes, estilos locais e recipe semântico da sua abertura.

Pertencem à `foundation`:

- `CommandShell`/scene host;
- renderer/Canvas;
- CameraDirector;
- geometria/apresentação compartilhada do Brasil;
- Terra/Globo, Mesa e Coroa Orbital;
- tokens globais e primitives compartilhadas;
- contrato público de scene intent;
- lifecycle/clock compartilhável para opening quando a animação cruza DOM e cena;
- priming/prewarm hooks necessários ao renderer;
- adaptadores que mutam internals Three.js compartilhados;
- cleanup de recursos transitórios pertencentes ao renderer.

Pertencem à trilha/página:

- intenção narrativa da abertura;
- duração e cue windows do seu recipe;
- coreografia DOM local;
- decisão de skip/bypass ligada à UX da página;
- EVAL e checkpoints visuais específicos.

Se uma abertura precisar transformar material/cena compartilhada, a página MUST solicitar um adapter/track mínimo à Foundation ou uma extensão declarativa do contrato; MUST NOT buscar refs privadas do Canvas.

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

Para uma opening complexa, o mock MAY implementar apenas lifecycle e cue windows DOM; não deve simular uma segunda engine 3D.

## Estratégia de integração

1. mergear/aprovar primeiro esta documentação em `dev`;
2. criar todas as branches de implementação a partir do mesmo `dev` atualizado;
3. congelar o contrato público mínimo da `foundation`;
4. publicar tipos/stubs necessários;
5. páginas avançam em paralelo contra o contrato;
6. integrar `foundation` primeiro;
7. antes de integrar cada página, sincronizar sua branch com o `dev` mais recente e resolver conflitos conscientemente;
8. integrar cada página separadamente, passando seus evals;
9. executar avaliação cruzada de transições e regressões;
10. validar a matriz `traceability.md` após todas as integrações.

## Evitar conflitos

MUST NOT:

- mover rotas durante desenvolvimento paralelo;
- renomear componentes compartilhados por estética;
- reformatar arquivos não relacionados;
- alterar APIs/realtime para resolver problema visual;
- adicionar UI kit, animation library ou segundo renderer sem decisão explícita;
- duplicar geometria territorial “parecida” para uma página;
- criar scene state que replique estado de negócio;
- criar um runtime/timeline de opening diferente em cada página quando o comportamento é compartilhável;
- fazer uma página manipular diretamente shader/câmera/material compartilhado fora da fronteira Foundation.

## Dependências entre trilhas

`foundation-contract` é dependência de interface, não de implementação completa. Home/Operations/Lobby/Doctrine/Profile SHOULD conseguir avançar após os tipos/contratos mínimos estarem estáveis.

`opening-choreography-protocol` é dependência somente das trilhas que adotam opening complexa. Uma página sem opening longa não precisa instanciar esse runtime.

Mudança breaking no contrato compartilhado MUST:

1. ser explicitada no PR da Foundation;
2. atualizar `manifest.json`/docs quando necessário;
3. identificar trilhas impactadas;
4. evitar merge até consumidores ativos estarem reconciliados.

## Política de merge

Cada PR de implementação MUST estar atualizado com `dev` antes do merge e MUST passar seu próprio EVAL no estado integrado, não apenas no estado anterior da branch.

Integração da Foundation não autoriza merge automático das páginas: cada trilha precisa provar compatibilidade com a versão efetivamente integrada do contrato.

## Evidência mínima de PR

Cada PR de página MUST trazer:

- referência ao spec e IDs dos evals atendidos;
- referência aos conceitos `CORE` aplicáveis de `traceability.md`;
- screenshots desktop/mobile dos estados principais;
- para openings complexas, checkpoints determinísticos e `post-cleanup`;
- lista de arquivos compartilhados tocados, idealmente vazia;
- resultado de testes/lint/build;
- justificativa para qualquer `SHOULD` não seguido;
- regressões conhecidas explicitadas;
- confirmação de que não alterou contratos fora do escopo.

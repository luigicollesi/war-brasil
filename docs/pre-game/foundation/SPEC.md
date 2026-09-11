# SPEC — Pre-game Foundation

**ID:** PRE-FOUNDATION  
**Owner:** trilha foundation  
**Escopo:** infraestrutura compartilhada; nenhuma regra de jogo.

## Objetivo

Criar a base que faz todas as páginas parecerem partes da mesma sala de comando e evita remontar a experiência 3D a cada navegação.

## Entregáveis

1. `CommandShell`: layout semântico e responsivo do pré-jogo.
2. `CommandScene`: Canvas 3D compartilhado com fallback 2D.
3. `CameraDirector`: recebe intenção de cena e controla câmera/transições.
4. `DomainTable`: Mesa de Domínio.
5. `BrazilTerritoryAssembly`: representação das 42 placas.
6. `OrbitalCrown`: três aros da Coroa Orbital.
7. primitives 2D: tipografia, command labels, linhas, status, painéis mínimos e insígnias.
8. tokens: cor, spacing, depth, material, motion e z-index.

## Arquitetura

A fundação deve manter estado visual separado de estado de negócio. Uma alteração de hover ou câmera não pode provocar refetch, recriar lobby ou alterar estado do jogo.

Preferir Server Components para casca/conteúdo estático e isolar a cena e interações em Client Components pequenos. O renderer 3D pode ser carregado de forma lazy; o conteúdo crítico da rota não deve aguardar WebGL.

## Contrato de cena

A API pública deve expressar **o que a página quer comunicar**, não posições XYZ da câmera.

Estados mínimos: `entrance`, `operations`, `lobby`, `doctrine`, `profile`.

O diretor de câmera é o único responsável por traduzir estado semântico em câmera, luz, intensidade do vermelho e movimento dos aros.

## Performance

- nenhum bloqueio de conteúdo por carregamento 3D;
- DPR deve ser limitado/adaptativo em dispositivos de alta densidade;
- objetos/materials/geometries estáveis devem ser reutilizados;
- loops ambientais devem ser reduzidos ou renderizados sob demanda quando possível;
- evitar sombras dinâmicas caras como requisito visual;
- fallback funcional quando WebGL falhar;
- evitar remontar Canvas por navegação de estado dentro da experiência.

## Responsividade

Mobile não é desktop comprimido. A cena serve de atmosfera e foco; ações permanecem em regiões acessíveis ao polegar, sem depender de hover.

Breakpoints seguem abordagem mobile-first do Tailwind, sem hardcode de dispositivo específico quando layout fluido resolve.

## Acessibilidade

- contraste de texto independe do brilho da cena;
- foco de teclado sempre visível;
- elemento decorativo 3D não entra na árvore de acessibilidade;
- `prefers-reduced-motion` possui variante estável;
- nenhuma ação depende apenas de cor, som, hover ou movimento.

## Não fazer

- não construir um motor genérico de cenas;
- não transformar o shell em design system de toda a aplicação;
- não duplicar a cena por página;
- não acoplar Three.js a APIs de matchmaking;
- não substituir o mapa do jogo por este asset visual.

## Definition of Done

Contrato público estável, fallback pronto, todos os modos renderizáveis isoladamente e `foundation/EVAL.md` aprovado.

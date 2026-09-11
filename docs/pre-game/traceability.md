# Traceability — Ideias originais → Specs → Evals

Objetivo: impedir que o redesign seja tecnicamente correto, porém incompleto. Cada conceito `CORE` abaixo MUST permanecer representado no spec e possuir pelo menos um gate/cenário de avaliação.

| Conceito | Classe | Spec(s) | Evidência/Eval esperado |
| --- | --- | --- | --- |
| Guerra Cerimonial Brasileira como identidade própria | CORE | `visual-language.md`, todas as páginas | percepção visual + ausência de WAR clássico/SaaS/sci-fi ciano |
| Tecnologia física, pesada e durável | CORE | `visual-language.md`, `foundation/SPEC.md` | materiais, profundidade e motion coerentes |
| Verde/carvão como massa; dourado como autoridade; vermelho como conflito | CORE | `visual-language.md` | estados idle/focus/conflito comparados |
| Mesa de Domínio como centro espacial | CORE | `foundation/SPEC.md`, Home, Operações, Lobby, Doutrina | presença e função mudam por modo sem virar background decorativo |
| Terra/globo → Brasil → Mesa como ritual de entrada | CORE | `foundation/SPEC.md`, `home/SPEC.md` | boot normal, skip, repeat visit, reduced-motion |
| Brasil físico composto por 42 territórios | CORE | `foundation/SPEC.md` | contagem, identidade territorial e montagem estável |
| Geometria/fronteiras canônicas preservadas | CORE | `foundation/SPEC.md` | comparação estrutural com asset/camada lógica do mapa |
| 2.5D perceptível sem deformar ou espalhar o mapa | CORE | `foundation/SPEC.md` | screenshots e inspeção geométrica |
| Fronteiras muito visíveis e leitura territorial clara | CORE | `foundation/SPEC.md` | avaliação em desktop/mobile e estados de foco |
| Hit-area lógica/semântica independente da face visual quando necessário | CORE | `foundation/SPEC.md` | teclado/touch/hover sem alterar geometria canônica |
| Ordem/identidade territorial permanece estável durante apresentação | CORE | `foundation/SPEC.md` | comparação estrutural + interação |
| Zoom/transformação visual não degrada espessura/leitura das fronteiras | CORE | `foundation/SPEC.md` | visual/interaction em estados de aproximação |
| Gestos mobile evitam seleção acidental do território | CORE | `foundation/SPEC.md` | interação touch/gesture |
| Coroa Orbital com três aros: Território, Comando e Conflito | CORE | `visual-language.md`, `foundation/SPEC.md` | idle e alinhamento cerimonial |
| Insígnia de Comando recorrente | CORE | `visual-language.md`, Lobby, Perfil | estados de jogador/ready/perfil |
| Cena compartilhada e persistente | CORE | `foundation/SPEC.md`, `parallel-development.md` | sequência de rotas sem múltiplos renderers/remount visual |
| Páginas emitem intenção; não manipulam câmera/Three internamente | CORE | `parallel-development.md`, `foundation/SPEC.md` | inspeção de imports/ownership |
| Home como ritual, não hero/site tradicional | CORE | `home/SPEC.md` | awaiting-entry + command-open |
| `ENTRAR NO COMANDO` como ação principal | CORE | `home/SPEC.md` | navegação utilizável antes/depois da cerimônia |
| Operações = autorizar nova operação ou localizar existente | CORE | `operations/SPEC.md` | create/join e estados de erro |
| Create/Join como dois modos da mesma máquina, não cards | CORE | `operations/SPEC.md` | avaliação visual desktop/mobile |
| Lobby como briefing com até seis estações | CORE | `lobby/SPEC.md` | 1, 2 e 6 jogadores + slots vazios |
| Ready materializado por insígnia/mecânica, não só cor | CORE | `lobby/SPEC.md` | ready/unready + acessibilidade |
| `CONFLITO AUTORIZADO` no início da partida | CORE | `lobby/SPEC.md` | todos prontos → transição única |
| Doutrina como demonstração estratégica, não wiki | CORE | `doctrine/SPEC.md` | capítulos, HTML completo e demonstrações |
| Reutilizar assets/regras reais do jogo | CORE | `doctrine/SPEC.md` | exemplos confrontados com fonte de verdade atual |
| Perfil como Salão de Comando/prestígio | CORE | `profile/SPEC.md` | guest/parcial/completo/vazio |
| Nunca inventar patente, ranking ou estatística | CORE | `profile/SPEC.md` | dados ausentes/parciais |
| Motion com velocidades semânticas e causa | CORE | `visual-language.md` | idle, interação e cerimônia |
| Navegação/transições espaciais sem bloquear a ação | CORE | Foundation + Home/Lobby | sequência entre modos e redirect imediato |
| Mobile é composição própria, não desktop comprimido | CORE | Foundation + todas as páginas | 390x844 + touch |
| `prefers-reduced-motion` funcional | CORE | Foundation + todas as páginas | variante estável equivalente |
| WebGL é enhancement, nunca requisito funcional | CORE | `foundation/SPEC.md` | fallback sem Canvas/WebGL |
| Performance sem renderer duplicado/flicker | CORE | `foundation/SPEC.md` | profiler/inspeção + sequência de modos |
| Som opcional e nunca requisito | SUPPORTING | `visual-language.md` | interface completa mutada |
| Sem armas/soldados/explosões como atalho visual | CORE | `visual-language.md` | revisão visual |
| Sem dashboard SaaS/cards/hexágonos/neon ciano genérico | CORE | `visual-language.md` | revisão visual |

## Regra de mudança

Se um conceito `CORE` for removido, substituído ou rebaixado, o PR MUST alterar esta matriz explicitamente e justificar a decisão. Silêncio ou simples ausência no código é considerado omissão.

Novas ideias aprovadas devem ser adicionadas aqui antes ou junto da implementação, mantendo rastreabilidade bidirecional entre intenção, spec e avaliação.

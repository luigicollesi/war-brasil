# EVAL — Home / Entrada

Avaliar conforme `../quality-standard.md` e `../traceability.md`.

## Gates BLOCKER

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| HOME-01 | `OPERAÇÕES` navega para `/matchmaking` | e2e/manual |
| HOME-02 | `DOUTRINA` navega para `/rules` | e2e/manual |
| HOME-03 | `COMANDO` navega para `/profile` | e2e/manual |
| HOME-04 | intro é pulável e reduced-motion não força sequência espacial | e2e/manual + snapshot |
| HOME-05 | fallback funcional existe quando WebGL está indisponível | fallback test |
| HOME-06 | metadata/structured data relevante não sofre regressão | inspection/test |
| HOME-07 | 390x844 não tem overflow horizontal nem ação dependente de hover | mobile/touch |
| HOME-08 | coreografia inicia somente depois da Foundation sinalizar `ready` | source + browser |
| HOME-09 | Brasil em repouso continua sendo os 42 territórios canônicos | visual + FND gates |
| HOME-10 | `ENTRAR NO COMANDO` permanece ação dominante no estado final | visual/semantic inspection |
| HOME-11 | destinos continuam controles DOM acessíveis | accessibility inspection |
| HOME-12 | primeira pintura visual da intro normal é preto absoluto | temporal snapshot |
| HOME-13 | intro executa uma única transformação contínua de 3000 ms | timing inspection + browser |
| HOME-14 | o mesmo `BrazilTerritoryAssembly` começa colorido e termina como mapa militar; não há segundo mapa visível | source + temporal snapshots |
| HOME-15 | compressão/descompressão usa oscilação de profundidade/escala e não spin convencional | browser + source |
| HOME-16 | fills canônicos interpolam para `PLATE_TONES`, roughness/metalness/borda finais da Foundation | source inspection |
| HOME-17 | aos 3000 ms a HOME coincide com o estado final baseline de `dev` sem salto ou redesign | visual regression |
| HOME-18 | identidade, chrome, CTA, atmosfera e rodapé materializam progressivamente e não aparecem em um único frame | temporal snapshots |
| HOME-19 | fallback 2D permanece invisível durante a intro WebGL normal; não existe crossfade 2D->3D | source + browser |
| HOME-20 | animação não depende de seletores posicionais frágeis (`nth-child`/ordem JSX) | source inspection/test |

## Score / 100

- 25 — continuidade e transformação do Brasil;
- 20 — fidelidade exata ao estado final de `dev`;
- 15 — abertura/preto/compressão e leitura cinematográfica;
- 15 — clareza e imediatismo da ação principal;
- 10 — materialização coordenada dos demais elementos;
- 10 — mobile/acessibilidade/reduced motion;
- 5 — performance/fallback.

Aprovação: >= 85 + todos os BLOCKERs.

## Testes de percepção

### HOME-V1 — Preto real

Em uma nova montagem da HOME com motion normal, a primeira leitura deve ser preta. Nenhum texto, mapa, mesa ou chrome pode piscar antes do início controlado.

### HOME-V2 — Um mapa

Acompanhar o Brasil durante toda a intro. Deve parecer inequivocamente o mesmo objeto ganhando forma, tamanho, posição, profundidade e acabamento. Não pode ser percebida uma troca de asset.

### HOME-V3 — Compressão/descompressão

Nos primeiros ~40% da animação, a oscilação deve parecer uma placa/mapa sendo comprimida em profundidade e liberada. Não deve lembrar rotação contínua de logo, loading spinner ou carta virando repetidamente.

### HOME-V4 — Militarização

O mapa deve atingir visibilidade com as cores regionais canônicas e depois perder gradualmente essa leitura cromática até os verdes escuros atuais. Bordas e material devem ganhar o acabamento da Foundation de forma contínua.

### HOME-V5 — Materialização da interface

Identidade, atmosfera, chrome, CTA e footer surgem em janelas diferentes, mas todos pertencem à mesma transformação. Não pode haver pop-in nem troca de tela inteira.

### HOME-V6 — Estado final baseline

Comparar `intro-100` com a HOME atual de `dev` no mesmo viewport. Câmera, Mesa, mapa, Coroa, globo, identidade, CTA, footer e chrome devem coincidir. Diferença estrutural reprova.

### HOME-V7 — Assentamento

Nos últimos ~400 ms o movimento deve desacelerar. O frame posterior à remoção dos estilos de intro não pode alterar posição, escala, rotação, cor ou opacidade perceptivelmente.

## Estados para snapshot

Desktop 1440x900 e mobile 390x844:

- `intro-preparing` — tela preta, Foundation pronta atrás;
- `intro-0` — começo do surgimento do mapa real;
- `intro-15` — mapa colorido comprimindo/descomprimindo;
- `intro-35` — mapa claramente visível e viajando para o estado operacional;
- `intro-60` — militarização e interface periférica em formação;
- `intro-85` — aproximação do layout final;
- `intro-100` — exatamente o estado operacional baseline de `dev`;
- `awaiting-entry`;
- `command-open`;
- `operations-focus`;
- `doctrine-focus`;
- `profile-focus`;
- `reduced-motion`;
- `fallback`.

Snapshots seguem as regras de determinismo de `../quality-standard.md`.

## Gate de rastreabilidade

Todos os conceitos `CORE` associados à Home em `../traceability.md` MUST estar presentes. Omissão reprova mesmo com score >= 85.

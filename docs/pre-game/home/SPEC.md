# SPEC — Home / Entrada no Comando

**Rota:** `/`  
**Cena:** `entrance`

Segue `../quality-standard.md`, `../visual-language.md` e os conceitos `CORE` aplicáveis em `../traceability.md`.

## Fantasia

A Home é um **ritual de materialização da Mesa de Domínio**. A tela nasce do preto absoluto e a própria representação operacional do Brasil se forma diante do usuário até chegar ao estado normal já aprovado da Foundation.

A Home MUST evitar hero tradicional e MUST continuar funcional quando motion/WebGL estiverem reduzidos ou indisponíveis.

## Objetivos do usuário

O jogador MUST conseguir:

- reconhecer WAR Brasil em poucos segundos;
- iniciar o caminho para uma partida;
- acessar Doutrina/Regras;
- acessar Perfil/Comando;
- pular a introdução;
- usar a página mesmo sem WebGL/motion.

## Sequência principal

1. a primeira pintura visual da HOME MUST ser preta;
2. a Foundation/WebGL pode preparar atrás do preto pelo tempo necessário;
3. quando a Foundation sinalizar `ready`, inicia uma única coreografia de **3000 ms**;
4. o próprio `BrazilTerritoryAssembly` da cena 3D MUST surgir com as cores canônicas lidas de `/war-brasil-42.production.svg`;
5. esse mesmo assembly MUST iniciar deslocado à direita e comprimido em perspectiva;
6. a entrada usa oscilação de `rotateY` + escala não uniforme para produzir compressão/descompressão, e não um spin convencional;
7. durante a mesma timeline, o assembly se move para sua posição operacional, cresce e interpola as cores canônicas para os materiais verde-escuros já usados pela Foundation;
8. atmosfera, identidade, chrome, CTA, telemetria e rodapé MUST materializar por opacidade e deslocamento, sem pop-in;
9. aos 3000 ms, posição, rotação, escala, materiais, câmera e composição MUST coincidir com o estado final existente em `dev`, sem redesign da tela final;
10. `OPERAÇÕES` -> `/matchmaking`, `DOUTRINA` -> `/rules`, `COMANDO` -> `/profile`.

A cerimônia MUST ser pulável. Enquanto `prefers-reduced-motion` não estiver ativo, a cerimônia SHOULD executar a cada nova montagem da HOME para manter o comportamento observável e testável. Reduced motion MUST começar diretamente no estado estável ou sem deslocamento espacial relevante.

## Regra de mapa único

Na execução WebGL normal existe **um único Brasil visível durante a abertura**: o `BrazilTerritoryAssembly` que também permanece como mapa operacional após a intro.

MUST NOT existir:

- um SVG de entrada sobreposto ao mapa 3D;
- crossfade perceptível entre mapa 2D e mapa 3D;
- troca de um asset colorido por outro asset verde;
- uma composição final alternativa à usada atualmente em `dev`.

O fallback 2D permanece exclusivamente como contingência quando WebGL estiver indisponível; ele não participa visualmente da intro WebGL normal.

## Coreografia cinematográfica

A timeline de 3000 ms é única. A HOME publica apenas estados semânticos `initial`, `running` e `settled`; coordenadas e timing interno do mapa pertencem à Foundation.

Durante `running`:

- o mapa começa invisível sobre preto e ganha opacidade gradualmente;
- a deformação usa rotação em Y alternada e escala X/Y não uniforme, simulando compressão/descompressão;
- a trajetória converge continuamente para a posição, rotação e escala finais do `BrazilTerritoryAssembly` atual;
- cores dos territórios interpolam dos fills canônicos para `PLATE_TONES`;
- roughness, metalness e bordas convergem para os valores normais da Foundation;
- DOM crítico SHOULD privilegiar `transform` e `opacity`;
- nada deve aparecer em um único frame.

No estado `settled`, a Foundation MUST definir explicitamente os mesmos valores finais usados antes da intro, evitando erro acumulado ou diferença causada pela interpolação.

## Estado final imutável

A animação é uma **entrada para a HOME atual**, não um redesign da HOME.

O estado após a intro MUST preservar:

- câmera/preset `table` existente;
- `DomainTable`;
- `OrbitalCrown`;
- `StrategicGlobe` recuado;
- `CommandInsignia`;
- `BrazilTerritoryAssembly` com os materiais militares atuais;
- identidade, CTA, footer, chrome e atmosfera nas posições atuais de `dev`.

Qualquer alteração perceptível do layout final em relação ao baseline de `dev` reprova a implementação.

## Navegação espacial

Após `ENTRAR NO COMANDO`, os três destinos SHOULD parecer setores/mecanismos da mesma Mesa, não cards independentes. A navegação real MUST continuar baseada em controles DOM acessíveis; a cena acompanha a intenção.

## Desktop e mobile

Desktop MUST preservar a Mesa/Brasil como protagonista. Mobile MUST manter a composição já existente, safe areas, alvos touch e nenhuma dependência de hover. O deslocamento inicial do mapa pode ser menor no mobile, mas o frame final MUST continuar idêntico ao estado mobile de `dev`.

## Estados

- `boot` / preto e preparação;
- `initial` / mapa preparado mas ainda não executando;
- `running` / coreografia de 3000 ms;
- `settled` / Foundation normal;
- `awaiting-entry`;
- `command-open`;
- `destination-focus`;
- `transitioning`;
- `reduced-motion`;
- `scene-fallback`.

## SEO e conteúdo

Preservar metadata/structured data relevantes já existentes. O redesign MUST NOT esconder todo conteúdo relevante atrás de Canvas.

## Não fazer

MUST NOT:

- substituir o estado final de `dev`;
- usar dois mapas visíveis para simular transformação;
- usar apenas fade-out de uma tela + fade-in de outra;
- usar spin 2D/360° convencional como gesto principal;
- criar elementos principais no meio da animação causando pop-in;
- manter vermelho pulsando continuamente;
- fazer CTA/link existir apenas como mesh 3D.

## Definition of Done

Do preto absoluto, o próprio mapa operacional surge colorido, comprime/descomprime, move-se e militariza até chegar exatamente ao estado final da HOME em `dev`, em 3000 ms, sem mapa duplicado, pop-in ou salto no último frame. `EVAL.md` passa integralmente.

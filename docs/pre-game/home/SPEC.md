# SPEC — Home / Entrada no Comando

**Rota:** `/`  
**Cena:** `entrance`

Segue `../quality-standard.md`, `../visual-language.md` e os conceitos `CORE` aplicáveis em `../traceability.md`.

## Fantasia

A primeira tela é um **ritual de autorização**. O usuário descobre uma instalação de comando, a escala do território e a Mesa de Domínio antes de receber os destinos principais.

A Home MUST evitar a estrutura de hero tradicional e MUST continuar imediatamente utilizável.

## Objetivos do usuário

O jogador MUST conseguir:

- reconhecer WAR Brasil em poucos segundos;
- iniciar o caminho para uma partida;
- acessar Doutrina/Regras;
- acessar Perfil/Comando;
- pular qualquer introdução ornamental;
- usar a página mesmo sem WebGL/motion.

## Sequência principal

1. primeira carga apresenta composição estável e CTA acessível imediatamente;
2. cerimônia curta MAY revelar `Terra -> Brasil -> Mesa de Domínio`;
3. marca WAR Brasil e `ENTRAR NO COMANDO` recebem prioridade;
4. ao entrar, revelar `OPERAÇÕES`, `DOUTRINA` e `COMANDO` como destinos da mesma instalação;
5. `OPERAÇÕES` -> `/matchmaking`;
6. `DOUTRINA` -> `/rules`;
7. `COMANDO` -> `/profile`.

A cerimônia MUST ser pulável. Em visita repetida da mesma sessão SHOULD iniciar de forma reduzida. `prefers-reduced-motion` MUST começar no estado estável ou usar transição sem deslocamento espacial relevante.

## Terra, Brasil e Mesa

A Terra serve para comunicar escala e MUST recuar após a revelação do Brasil. Não pode ser o único diferencial visual.

O Brasil MUST aparecer como unidade territorial física de 42 placas canônicas, encaixadas em repouso. A Mesa é protagonista arquitetônica, não background.

A Coroa Orbital SHOULD estar presente em movimento ambiente lento; seu alinhamento completo é reservado a autorização/conflito.

## Navegação espacial

Após `ENTRAR NO COMANDO`, os três destinos SHOULD parecer setores/mecanismos da mesma Mesa, não cards independentes.

Foco em `OPERAÇÕES` MAY introduzir tensão/vermelho e separação territorial leve. `DOUTRINA` SHOULD tender à leitura/análise. `COMANDO` SHOULD orientar a Insígnia/prestígio.

A navegação real MUST continuar baseada em controles DOM acessíveis; a cena acompanha a intenção.

## Desktop

- Mesa/Brasil dominam a composição;
- UI textual é mínima e hierárquica;
- vermelho é praticamente ausente antes de Operações;
- nenhum painel grande compete com o objeto de comando;
- CTA principal permanece inequívoco.

## Mobile

Mobile MUST ser recomposto:

- Brasil/Mesa como foco superior/central;
- CTA principal em região confortável de touch;
- três destinos com alvos grandes e labels persistentes;
- sem hover/parallax obrigatórios;
- câmera pode ser simplificada se melhorar legibilidade.

## Estados

- `boot`
- `awaiting-entry`
- `command-open`
- `destination-focus`
- `transitioning`
- `repeat-visit`
- `reduced-motion`
- `scene-fallback`

Todo estado MUST possuir saída funcional e estado final determinístico.

## SEO e conteúdo

Preservar metadata/structured data relevantes já existentes: indexabilidade, title, description, canonical/OpenGraph aplicáveis e representação WebApplication. O redesign MUST NOT esconder todo conteúdo relevante atrás de Canvas.

## Não fazer

MUST NOT:

- usar hero com texto à esquerda + imagem à direita como estrutura principal;
- mostrar três cards grandes como navegação principal;
- fazer do globo o protagonista permanente;
- exigir intro antes de oferecer skip/ação;
- manter vermelho pulsando continuamente;
- inserir marketing longo acima da dobra;
- fazer link/CTA existir apenas como mesh 3D.

## Definition of Done

O primeiro contato produz ritual, escala e autoridade sem atrasar o usuário; todos os destinos e fallbacks funcionam e `EVAL.md` passa integralmente.

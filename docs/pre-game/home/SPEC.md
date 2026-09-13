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

1. primeira carga apresenta imediatamente o Brasil canônico colorido, deslocado para o lado direito, com CTA funcional;
2. enquanto o WebGL prepara em segundo plano, a composição inicial MUST permanecer estável e utilizável;
3. quando a Foundation estiver pronta, a tela inteira MUST executar uma transformação contínua de **3000 ms** até o estado operacional;
4. o Brasil MUST deslocar-se suavemente da direita ao centro enquanto perde protagonismo cromático e passa a integrar a Mesa de Domínio;
5. marca, chrome, atmosfera, CTA, telemetria e rodapé MUST transformar posição/opacidade gradualmente durante a mesma coreografia; nenhum elemento principal pode surgir em um único frame;
6. o fallback 2D e o Canvas 3D MUST sobrepor-se durante o handoff, preservando o Brasil como âncora visual contínua;
7. ao entrar, revelar `OPERAÇÕES`, `DOUTRINA` e `COMANDO` como destinos da mesma instalação;
8. `OPERAÇÕES` -> `/matchmaking`;
9. `DOUTRINA` -> `/rules`;
10. `COMANDO` -> `/profile`.

A cerimônia MUST ser pulável em qualquer momento. Em visita repetida da mesma sessão SHOULD iniciar diretamente no estado estável. `prefers-reduced-motion` MUST começar no estado estável ou usar transição sem deslocamento espacial relevante.

## Coreografia cinematográfica

A entrada da primeira visita possui um único relógio lógico de **3 segundos**, iniciado somente depois que a Foundation sinaliza que a cena necessária para o handoff está pronta.

O primeiro frame MUST conter o Brasil colorido já visível e deslocado à direita. A interface periférica MAY começar com presença visual muito baixa, porém seus principais elementos MUST já existir no layout para que a sensação seja de transformação, não de montagem progressiva de uma nova tela.

Durante os 3000 ms:

- movimento espacial SHOULD usar uma curva expressiva sem bounce/overshoot;
- DOM crítico SHOULD privilegiar `transform` e `opacity`;
- o escurecimento SHOULD ocorrer preferencialmente por composição/camadas, evitando animações caras de `filter` no caminho crítico;
- o Canvas pode permanecer visualmente encoberto no início enquanto assume a pose final atrás do fallback;
- o handoff 2D -> 3D SHOULD acontecer apenas quando as duas representações estiverem visualmente próximas;
- no instante final, a cena MUST coincidir com o estado normal de `awaiting-entry`, sem salto de posição, opacidade ou escala.

Carregamento de WebGL não conta como parte dos três segundos: recursos podem preparar pelo tempo necessário antes da coreografia começar. Falha de WebGL MUST cair para a composição 2D funcional sem tentar executar uma transição incompleta.

## Terra, Brasil e Mesa

A Terra serve para comunicar escala e MUST recuar após a revelação do Brasil quando fizer parte de uma variação futura da cerimônia. Não pode ser o único diferencial visual.

Na coreografia atual, o Brasil é a âncora inicial. Ele MUST aparecer como unidade territorial de 42 placas canônicas e terminar integrado à Mesa de Domínio. A Mesa é protagonista arquitetônica, não background.

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
- deslocamento inicial do Brasil para a direita deve ser menor que no desktop para não recortar a leitura do mapa;
- CTA principal em região confortável de touch;
- três destinos com alvos grandes e labels persistentes;
- sem hover/parallax obrigatórios;
- câmera pode ser simplificada se melhorar legibilidade.

## Estados

- `boot` / preparação;
- `awaiting-entry`;
- `command-open`;
- `destination-focus`;
- `transitioning`;
- `repeat-visit`;
- `reduced-motion`;
- `scene-fallback`.

Todo estado MUST possuir saída funcional e estado final determinístico.

## SEO e conteúdo

Preservar metadata/structured data relevantes já existentes: indexabilidade, title, description, canonical/OpenGraph aplicáveis e representação WebApplication. O redesign MUST NOT esconder todo conteúdo relevante atrás de Canvas.

## Não fazer

MUST NOT:

- usar hero com texto à esquerda + imagem à direita como estrutura principal;
- mostrar três cards grandes como navegação principal;
- fazer do globo o protagonista permanente;
- exigir intro antes de oferecer skip/ação;
- criar elementos principais apenas no meio da animação, causando aparição súbita;
- trocar fallback por Canvas em um único frame perceptível;
- manter vermelho pulsando continuamente;
- inserir marketing longo acima da dobra;
- fazer link/CTA existir apenas como mesh 3D.

## Definition of Done

O primeiro contato transforma continuamente o Brasil colorido na Mesa de Domínio em três segundos, sem saltos perceptíveis, preservando ação imediata, acessibilidade, fallbacks e todos os destinos. `EVAL.md` passa integralmente.

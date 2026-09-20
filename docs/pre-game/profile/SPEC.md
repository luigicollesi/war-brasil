# SPEC — PROFILE V4 / Quartel do Comandante

**Rotas próprias:** `/profile`, `/profile/arsenal`, `/profile/store`  
**Rota pública:** `/profile/[handle]`  
**Cena:** `profile`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

Economia, wallet, catálogo jogável, offers, preços, purchases, inventário, loadout e snapshot cosmético são regidos exclusivamente por `../../economy/SPEC.md`. Este documento define como essas capacidades aparecem e se integram à experiência de Profile.

## Objetivo

PROFILE V4 transforma o antigo Quartel composto por estações concorrentes em um Command Center de três superfícies primárias:

1. **Dossiê** — identidade, edição, presença, rede e histórico;
2. **Arsenal** — inventário cosmético possuído e loadout equipado;
3. **Intendência** — catálogo comercial, inspeção e compra com Créditos de Campanha.

A experiência MUST parecer uma interface de jogo premium/AAA coerente com a Home e a Foundation, evitando aparência de dashboard administrativo.

A V4 MUST melhorar aproveitamento de viewport, hierarquia visual e foco nos próprios cosméticos.

## Mudança estrutural em relação à V3

A V4 substitui deliberadamente a composição de cinco estações da V3.

Deixam de existir como eixos primários:

- estação separada `Tesouraria`;
- estação compacta `Intendência` dentro do grid do Profile;
- `Mesa de Comando Pessoal` como núcleo central;
- bloco `Identidade em foco` que repete informação do Dossiê;
- navegação principal por cinco sistemas concorrentes.

`Mesa de Comando Pessoal` e `Identidade em foco` MUST NOT ocupar espaço funcional ou decorativo na nova composição.

Tesouraria passa a ser informação global de wallet no shell.

Rede de Comando e Livro de Campanha continuam funcionais, mas tornam-se módulos secundários do Dossiê em vez de superfícies primárias paralelas.

## Regra estrutural — nenhuma imagem de perfil

PROFILE V4 MUST NOT possuir foto de perfil, avatar ou retrato de comandante.

A identidade visual MUST ser construída com:

- `displayName`;
- `handle`;
- bio opcional;
- título cosmético textual;
- presença;
- atividade;
- tipografia;
- monograma/iniciais derivados em runtime quando necessários;
- elementos gráficos da interface que não funcionem como retrato persistente.

MUST NOT existir espaço vazio reservado para futura foto de perfil.

MUST NOT usar imagem OAuth como identidade do comandante.

## Arquitetura de rotas

### `/profile` — Dossiê

Representa a identidade e contexto social/histórico do próprio comandante autenticado.

### `/profile/arsenal` — Arsenal

Representa apenas inventário jogável possuído e loadout cosmético do próprio usuário.

### `/profile/store` — Intendência

Representa catálogo comercial e compra com `campaign-credit`, além da seção demonstrativa de pacotes de créditos em BRL.

### `/profile/[handle]` — perfil público

Continua representando projeção pública de outro comandante e MUST permanecer separado das superfícies privadas Arsenal/Intendência.

## ProfileShell

As três rotas privadas MUST compartilhar uma linguagem de shell coerente.

O shell SHOULD permanecer visualmente estável durante navegação e MUST fornecer:

- ação de retorno ao comando/Home;
- identidade textual resumida do usuário;
- navegação entre `Dossiê`, `Arsenal` e `Intendência`;
- saldo de `campaign-credit` quando a fonte econômica estiver disponível, acompanhado pelo asset canônico `/coin.svg`;
- ação visual associada a adquirir créditos que navega para a seção de packs em `/profile/store`, sem executar pagamento real.

A wallet deixa de ser conteúdo central de página e passa a ser informação contextual global.

Saldo `0` MUST ser mostrado somente quando a economia retornou `0` real. Fonte indisponível MUST possuir estado próprio e MUST NOT virar `0` sintético.

`/coin.svg` MUST ser tratado como asset estrutural local da interface. Profile MUST NOT solicitar esse ícone ao R2 nem depender de `ASSET_STORAGE_URL` para representar saldo/preço.

O ícone da moeda SHOULD ser decorativo quando já existir texto/valor acessível equivalente. A acessibilidade MUST comunicar `Créditos de Campanha` e o valor, não apenas “imagem” ou “moeda”.

## Identidade visual

A V4 MUST herdar a linguagem visual da Home/Foundation:

- carvão/verde militar escuro como base;
- marfim para conteúdo principal;
- latão/dourado para prestígio, foco e valor;
- vermelho operacional para conflito, erro, indisponibilidade crítica e alertas;
- linhas finas, superfícies translúcidas controladas e profundidade discreta;
- tipografia de display para títulos e mono para telemetria/labels;
- assimetria controlada em desktop;
- redução de ornamentação quando ela não carrega significado.

A UI MUST priorizar conteúdo jogável real — itens, slots, ofertas e identidade — em vez de grandes elementos puramente decorativos.

A representação visual de `campaign-credit` MUST permanecer consistente entre shell, cards, hero e packs usando o mesmo `/coin.svg`.

## Foundation

PROFILE continua usando a Foundation somente por sua API pública semântica.

PROFILE MUST NOT importar diretamente Three, React Three Fiber, Canvas, câmera ou internals da cena.

As três superfícies MAY publicar intenções semânticas diferentes para a Foundation, por exemplo:

- Dossiê: foco institucional/identidade;
- Arsenal: foco em equipamento;
- Intendência: foco em vitrine/comércio.

Mudança de rota MUST NOT recriar desnecessariamente recursos pesados da Foundation quando o shell puder ser preservado.

## Dossiê

Dossiê é a superfície inicial de `/profile`.

A primeira leitura SHOULD responder:

- quem é o comandante;
- qual título utiliza;
- qual sua presença/atividade;
- qual sua bio;
- quais ações pessoais estão disponíveis;
- quais são seus contextos sociais e históricos recentes.

### Conteúdo primário

Dossiê MUST comportar:

- display name;
- `@handle`;
- título cosmético textual;
- bio;
- presença;
- atividade;
- ação clara `Editar Dossiê` ou equivalente.

Monograma MAY ser usado como detalhe compacto, mas MUST NOT recriar um grande pseudo-avatar.

### Ajuste Dossiê

A funcionalidade atual de edição MUST ser integrada à composição do Dossiê em vez de aparecer como painel desconectado após toda a página.

Em desktop, edição SHOULD abrir em painel contextual/lateral ou região dedicada da própria composição.

Em mobile, MAY abrir como painel vertical ou sheet acessível.

A edição MUST preservar as regras server-side atuais de autorização, privacidade e validação.

### Rede de Comando

Rede continua suportando:

- amigos persistentes;
- solicitações recebidas e enviadas;
- busca sob demanda;
- contatos recentes quando disponíveis;
- remover amizade;
- bloquear/desbloquear;
- estados vazio, indisponível e erro.

No Dossiê, a visualização inicial SHOULD ser compacta e oferecer expansão/navegação para operações mais detalhadas sem competir com identidade.

### Livro de Campanha

Histórico continua vindo de `game.*`, paginado por cursor/keyset e preservando snapshots históricos.

Dossiê SHOULD mostrar resumo recente e permitir continuidade explícita.

Histórico profundo MUST NOT usar OFFSET.

## Arsenal

`/profile/arsenal` é a superfície privada de personalização dos cosméticos possuídos.

Arsenal MUST NOT funcionar como loja paralela.

Itens não possuídos MUST NOT ser apresentados como parte do inventário principal.

### Loadout ativo

A região de maior prioridade do Arsenal MUST expor exatamente quatro Equipment Bays:

- Ataque;
- Defesa;
- Neutro;
- Território.

Cada bay MUST mostrar:

- categoria/slot;
- nome do item equipado;
- estado `EQUIPADO`;
- preview visual quando houver asset representável;
- fallback explícito quando preview não estiver disponível.

Para dados, preview SHOULD usar a entrega WebP definida pelo domínio econômico.

Para efeito territorial, SHOULD existir amostra visual que preserve a leitura da cor do jogador; ela não precisa simular o mapa inteiro.

### Inventário possuído

Abaixo do loadout, Arsenal MUST listar ownership real recebido do domínio econômico.

Filtros mínimos:

- Todos;
- Ataque;
- Defesa;
- Neutro;
- Território.

O item atualmente equipado MUST possuir destaque mais forte que um item apenas possuído.

Estados permitidos na UI incluem:

- `EQUIPADO`;
- `POSSUÍDO`;
- `ARQUIVADO` para item retirado que continua possuído;
- indisponibilidade de preview quando aplicável.

Um item não possuído MUST NOT receber CTA `EQUIPAR`.

### Equipagem

Equipagem MUST usar a boundary econômica existente/atualizada.

A UI MAY atualizar seleção de forma otimista apenas quando possuir rollback claro, mas estado final MUST ser reconciliado pelo servidor.

Após reload, o item equipado MUST continuar refletindo `profile.cosmetic_loadout` autoritativo.

Equipagem MUST NOT alterar wallet, ledger ou purchase.

## Intendência

`/profile/store` é a loja principal.

Ela MUST ocupar a maior parte útil da viewport e tratar produtos/coleções como protagonistas visuais.

A UI MUST ser dirigida integralmente pelo snapshot econômico retornado pelo backend.

MUST NOT existir:

- allowlist temática no componente;
- preço hardcoded;
- conhecimento obrigatório de `viking`, `gato`, `futebol` ou qualquer slug concreto;
- descoberta de produto via bucket R2;
- compra simulada somente no client.

## Hierarquia da Intendência

A ordem conceitual SHOULD ser:

1. header/shell com wallet;
2. destaque/hero comercial;
3. catálogo de offers;
4. categorias/filtros quando úteis;
5. inspeção detalhada do item/offer selecionado;
6. seção final `Reforçar Tesouraria` com pacotes de créditos em BRL não adquiríveis.

### Hero

Store SHOULD destacar uma offer marcada como featured ou a primeira elegível segundo ordem persistida.

Hero SHOULD expor:

- preview grande;
- nome;
- descrição curta;
- composição relevante;
- preço em `campaign-credit` acompanhado por `/coin.svg`;
- CTA coerente com estado de compra.

Ausência de offer featured MUST possuir fallback determinístico orientado pelo backend, sem slug especial no React.

### Cards comerciais

Cada card de offer SHOULD expor:

- preview;
- nome;
- categoria/conjunto quando relevante;
- preço acompanhado por `/coin.svg` quando a moeda for `campaign-credit`;
- estado de ownership;
- CTA correspondente.

Estados esperados:

- `COMPRAR` para offer adquirível;
- `POSSUÍDO` para offer integralmente possuída;
- progresso como `1/3 POSSUÍDOS` quando ownership for parcial;
- `INDISPONÍVEL`/`EM BREVE` quando não adquirível segundo backend.

O frontend MUST NOT inventar descontos para ownership parcial.

### Inspeção

Selecionar uma offer SHOULD abrir inspeção sem exigir navegação para outra rota.

Desktop SHOULD preferir painel lateral/detalhe integrado.

Mobile SHOULD preferir bottom sheet ou painel vertical equivalente.

Inspeção MAY alternar entre assets da composição da offer, como Ataque/Defesa/Neutro.

Abrir/fechar preview MUST NOT alterar inventory, wallet ou loadout.

## Compra com Créditos de Campanha

CTA `COMPRAR` MUST usar a API econômica definida em `../../economy/SPEC.md`.

A UI MUST enviar somente identificador da offer e idempotency key conforme contrato.

A UI MUST NOT enviar preço autoritativo, moeda, saldo, userId ou lista de cosméticos a conceder.

Durante compra:

- CTA MUST impedir spam acidental na mesma interação;
- estado pending deve ser visível;
- erros de saldo insuficiente/indisponibilidade devem ser claros;
- confirmação deve atualizar wallet e ownership a partir do servidor;
- feedback não deve bloquear navegação ou acessibilidade.

Compra confirmada SHOULD produzir feedback visual de aquisição, sem animações excessivas que prejudiquem performance.

Quando o feedback exibir o novo saldo ou valor gasto, MUST reutilizar `/coin.svg` como representação visual de `campaign-credit`.

## Reforçar Tesouraria

Ao final da loja MUST existir região para pacotes futuros de `campaign-credit` em BRL quando o catálogo os retornar.

Cada pack pode mostrar:

- quantidade de créditos acompanhada por `/coin.svg`;
- preço em reais;
- estado `EM BREVE`.

Nesta entrega o CTA MUST ser disabled ou semanticamente não acionável como compra real.

MUST NOT existir checkout, redirect para PSP, formulário de pagamento, webhook ou falsa confirmação de saldo.

O botão global de adicionar créditos no shell MUST navegar/focar esta região e não executar pagamento.

O ícone de `campaign-credit` MUST permanecer visualmente separado da representação de BRL para evitar sugerir que a moeda do jogo e Real são a mesma unidade.

## Responsividade

### Desktop 1440x900

O shell MUST permanecer legível e estável.

Dossiê SHOULD priorizar identidade e edição sem scroll global obrigatório para a função principal.

Arsenal e Intendência MAY possuir área de conteúdo rolável porque inventário/catálogo são naturalmente extensíveis, mas header/navigation SHOULD permanecer acessíveis.

Não existe requisito de comprimir catálogo inteiro em uma única viewport.

### Mobile 390x844

Mobile MUST ser uma composição própria para toque, não uma redução literal do desktop.

Shell SHOULD condensar para:

- voltar;
- nome/contexto mínimo;
- saldo com `/coin.svg`;
- navegação de três itens.

Store SHOULD usar:

- hero vertical;
- grid de até duas colunas quando legível;
- inspection como sheet/painel vertical;
- CTAs com alvo de toque apropriado.

Arsenal SHOULD reorganizar Equipment Bays em 2x2 ou carrossel acessível, seguido de grid de inventário.

A experiência MUST NOT depender de hover.

## Motion

Motion deve reforçar mudança de contexto e seleção, não competir com leitura.

São permitidas/analisadas:

- transição entre superfícies;
- entrada do hero;
- hover/focus de cards;
- seleção de Equipment Bay;
- abertura de inspection;
- confirmação de equipagem;
- confirmação de compra;
- atualização visual de saldo.

Animações críticas SHOULD priorizar `transform` e `opacity`.

MUST evitar loops caros, relayout contínuo ou filtros que degradem hardware modesto.

### Reduced motion

Com `prefers-reduced-motion: reduce`:

- parallax MUST ser removido;
- float/oscilações contínuas MUST ser removidos;
- sweeps decorativos MUST ser removidos;
- transições devem ser reduzidas ou instantâneas;
- hierarquia, feedback e estado MUST permanecer claros.

## Autenticação e autorização

As rotas privadas derivam usuário exclusivamente de `session.user.id`.

Mutações MUST NOT aceitar `userId` do browser como identidade do ator.

Route Handlers e services repetem autenticação/authorization server-side independentemente de proteção de navegação.

Acesso não autenticado a superfícies privadas deve redirecionar ou responder conforme convenção do projeto.

## Identidade e privacidade

`profile.commanders` permanece 1:1 com `auth.user`.

Handle continua único case-insensitive.

Presença, atividade, histórico e solicitações de amizade continuam respeitando política persistida.

Privacidade MUST ser aplicada server-side antes da formação de DTO público.

`/profile/[handle]` MUST continuar usando DTO público próprio e MUST NOT reutilizar DTO privado escondendo campos no cliente.

Perfil público MUST NOT expor email, user ID interno, tokens, providers, IP, `player_session`, wallet privada, inventory privado ou imagem OAuth.

## Presença e atividade

Presença continua efêmera via TTL e atividade continua derivada de `game.*`.

Redis indisponível MUST produzir `presence=unavailable`, nunca falso `offline`.

Estados como `offline + match` continuam representáveis.

Heartbeat MUST permanecer autenticado e não escrever PostgreSQL a cada pulso.

## Social

Amizade permanece simétrica e solicitação direcional.

Busca continua sob demanda e limitada.

O banco/serviço continua impedindo self-request, duplicatas/inversões e solicitações simultâneas incompatíveis.

Aceitar, remover e bloquear devem preservar as garantias transacionais existentes.

Nenhuma superfície social passa a depender de avatar.

## Histórico

Histórico MUST usar `game.*` real, LIMIT + cursor/keyset e snapshots persistidos de identidade textual.

Edição posterior de nome/handle MUST NOT reescrever histórico antigo.

Histórico MUST NOT persistir imagem de perfil.

## Contratos de dados

Fluxo server-side continua:

```text
Page/Route Handler -> Service -> authorization/privacy -> Repository -> PostgreSQL/Redis -> DTO
```

React components MUST NOT executar SQL diretamente.

Superfícies econômicas consomem contratos do domínio econômico em vez de duplicar tipos/regras comerciais no Profile.

O frontend MAY conhecer estaticamente a associação visual `campaign-credit -> /coin.svg`; isso não transforma o cliente em autoridade de saldo, preço ou moeda. O path do ícone não precisa ser enviado repetidamente pelo backend.

Falha de uma fonte secundária MUST possuir estado explícito. Ausência de fonte MUST NOT ser convertida em zero/lista vazia/offline sintético.

## Performance

Profile MUST evitar N+1 social/presença.

Store/Arsenal MUST evitar carregar todos os assets completos fora de viewport.

Previews SHOULD usar lazy loading e referência dedicada quando disponível.

Navegar entre Dossiê, Arsenal e Intendência SHOULD reutilizar o máximo possível do shell/Foundation estáveis.

Animações não devem causar flicker de cena nem remontagem pesada do background.

`coin.svg` SHOULD aproveitar cache normal de asset estático e ser reutilizado entre wallet, cards e packs, sem depender de chamadas ao R2.

## Acessibilidade

Todas as três superfícies MUST ser utilizáveis por teclado quando aplicável e por toque em mobile.

Focus visible MUST ser inequívoco.

Estado não pode depender somente de cor.

Saldo, preço, ownership, equipped e erros devem possuir representação textual.

O uso de `/coin.svg` MUST preservar nome e valor de `Créditos de Campanha` em texto ou accessible name equivalente; o usuário não pode precisar interpretar exclusivamente a imagem para entender um preço ou saldo.

Inspection/sheets devem manter foco gerenciável e fechamento acessível.

Contraste deve permanecer legível mesmo em navegadores/OS com dark mode ou forced color behavior compatível com a aplicação.

## Estados de falha

Devem existir estados explícitos para, no mínimo:

- loading;
- identidade indisponível;
- economia indisponível;
- saldo indisponível;
- catálogo vazio;
- inventário somente com defaults;
- preview indisponível;
- saldo insuficiente;
- compra recusada;
- erro de equipagem;
- social vazio/indisponível;
- histórico vazio/indisponível;
- Foundation fallback.

Falha econômica MUST NOT derrubar Dossiê, social ou histórico quando suas próprias fontes estiverem disponíveis.

Falha/indisponibilidade do R2 cosmético MUST NOT impedir o carregamento do `/coin.svg` local.

## Fora de escopo do Profile V4

- avatar/foto de perfil;
- rank competitivo novo;
- marketplace entre jogadores;
- gifting;
- checkout com dinheiro real;
- gestão de cartão/pagamento;
- lógica financeira duplicada no Profile;
- editor cosmético de assets;
- mistura entre perfil público e inventário privado.

## Critério de conclusão

PROFILE V4 só está pronto quando:

- `/profile`, `/profile/arsenal` e `/profile/store` formam uma experiência coerente;
- a antiga Mesa de Comando não ocupa mais a composição;
- Dossiê usa melhor o espaço e integra edição, social e histórico;
- Arsenal mostra ownership real e quatro itens equipados;
- Intendência apresenta catálogo dinâmico, preços reais e compra com créditos;
- wallet, preços de offer e quantidades de créditos usam `/coin.svg` de forma consistente;
- pacotes BRL aparecem somente como futuros e não alteram saldo;
- identidade continua sem avatar;
- desktop/mobile/reduced-motion/fallback são operáveis;
- regras econômicas continuam centralizadas em `docs/economy`;
- todos os BLOCKERs de `EVAL.md` estão verdes.

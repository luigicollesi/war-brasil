# EVAL — PROFILE V4 / Quartel do Comandante

Avaliar conforme `../quality-standard.md`, `../traceability.md`, `../visual-language.md` e `SPEC.md`.

Aprovação exige **todos os BLOCKERs verdes** e score >= 90/100.

A regra estrutural continua: **nenhum comandante possui imagem de perfil, avatar ou retrato**.

Economia, wallet, offers, preço, purchase, inventário, loadout jogável, catálogo e snapshot cosmético são avaliados autoritativamente por `../../economy/EVAL.md`. Este EVAL valida a integração dessas capacidades no Profile sem duplicar regras financeiras.

## Gates BLOCKER — arquitetura V4

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-ARCH-01 | `/profile` representa Dossiê, `/profile/arsenal` Arsenal e `/profile/store` Intendência | route/E2E |
| PRO4-ARCH-02 | as três superfícies privadas compartilham linguagem de shell coerente | DOM/visual |
| PRO4-ARCH-03 | não existe `Mesa de Comando Pessoal` como núcleo visual/funcional da V4 | DOM/source negative |
| PRO4-ARCH-04 | não existe bloco redundante `Identidade em foco` ocupando área central | DOM/source negative |
| PRO4-ARCH-05 | Tesouraria não é estação primária separada; wallet é contexto global do shell | visual/DOM |
| PRO4-ARCH-06 | Rede e Livro de Campanha continuam funcionais dentro da hierarquia do Dossiê | E2E |
| PRO4-ARCH-07 | Profile não redefine tipos/regras econômicas autoritativas que pertencem a `docs/economy` | architecture review |

## Gates BLOCKER — shell

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-SHELL-01 | shell expõe retorno ao comando e navegação Dossiê/Arsenal/Intendência | E2E/DOM |
| PRO4-SHELL-02 | superfície ativa é identificável visualmente e semanticamente | accessibility/DOM |
| PRO4-SHELL-03 | saldo mostrado vem do DTO econômico real | DB→DTO→DOM |
| PRO4-SHELL-04 | saldo indisponível não é convertido em `0` | failure E2E |
| PRO4-SHELL-05 | ação de adicionar créditos navega/foca `Reforçar Tesouraria` e não executa pagamento | E2E |
| PRO4-SHELL-06 | navegação via back/forward mantém rotas e superfície coerentes | browser E2E |
| PRO4-SHELL-07 | shell permanece utilizável quando catálogo/store está indisponível | failure E2E |
| PRO4-SHELL-08 | saldo de `campaign-credit` usa `/coin.svg` como representação visual canônica junto ao valor | E2E/DOM/visual |
| PRO4-SHELL-09 | shell não depende de R2/`ASSET_STORAGE_URL` para renderizar o ícone da moeda | network/failure E2E |

## Gates BLOCKER — Dossiê

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-DOS-01 | primeira leitura apresenta nome, handle, título, bio, presença e atividade sem depender de avatar | DOM/visual |
| PRO4-DOS-02 | não existe moldura/slot vazio que sugira foto de perfil ausente | 1440x900 + 390x844 visual |
| PRO4-DOS-03 | `Ajuste Dossiê` está integrado à composição e não aparece como painel desconectado após todo o conteúdo | interaction/visual |
| PRO4-DOS-04 | editar display name/bio/privacidade continua persistente e autorizado server-side | integration |
| PRO4-DOS-05 | Rede de Comando permanece acessível e funcional | E2E |
| PRO4-DOS-06 | histórico recente permanece acessível e possui continuidade explícita | E2E |
| PRO4-DOS-07 | social/histórico não competem visualmente com identidade como cinco estações equivalentes | visual review |
| PRO4-DOS-08 | falha econômica não derruba identidade, social ou histórico quando suas fontes estão disponíveis | failure E2E |

## Gates BLOCKER — Arsenal

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-ARS-01 | `/profile/arsenal` exige autenticação | route/E2E |
| PRO4-ARS-02 | Arsenal expõe exatamente quatro Equipment Bays: Ataque, Defesa, Neutro e Território | DOM/contract |
| PRO4-ARS-03 | cada bay mostra o item efetivamente equipado retornado pelo backend | DTO→DOM |
| PRO4-ARS-04 | item equipado possui destaque inequívoco sem depender somente de cor | visual/accessibility |
| PRO4-ARS-05 | inventário principal lista somente itens possuídos | negative DOM/DTO |
| PRO4-ARS-06 | filtros Todos/Ataque/Defesa/Neutro/Território filtram ownership sem alterar autoridade | interaction test |
| PRO4-ARS-07 | item não possuído nunca recebe CTA `EQUIPAR` | negative E2E |
| PRO4-ARS-08 | item possuído compatível pode ser equipado | E2E/integration |
| PRO4-ARS-09 | equipagem persiste após reload | E2E |
| PRO4-ARS-10 | equipar um slot não altera visualmente os outros três além do estado necessário | interaction/E2E |
| PRO4-ARS-11 | item `retired` já possuído continua representável como arquivado e não desaparece do ownership | compatibility E2E |
| PRO4-ARS-12 | preview ausente possui fallback legível | failure E2E |

## Gates BLOCKER — Intendência

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-STORE-01 | `/profile/store` exige autenticação | route/E2E |
| PRO4-STORE-02 | loja ocupa a superfície principal e prioriza produtos/preview em vez de widgets administrativos | visual review |
| PRO4-STORE-03 | hero/destaque deriva de dados retornados, sem slug temático especial | source/integration |
| PRO4-STORE-04 | todas as offers renderizadas vêm do snapshot econômico | DTO/DOM |
| PRO4-STORE-05 | preço exibido é o preço retornado pelo backend e usa `/coin.svg` para representar `campaign-credit` | DB→DTO→DOM |
| PRO4-STORE-06 | card diferencia comprável, possuído, parcialmente possuído e indisponível | E2E/visual |
| PRO4-STORE-07 | ownership parcial é mostrado sem desconto inventado no client | DOM/source |
| PRO4-STORE-08 | novo offer válido aparece sem alteração temática no React | integration |
| PRO4-STORE-09 | alterar preço no banco altera UI sem rebuild | integration |
| PRO4-STORE-10 | preview/inspection não altera wallet, ownership ou loadout | interaction/integration |
| PRO4-STORE-11 | inspection é operável por teclado e toque | accessibility/manual |
| PRO4-STORE-12 | ausência/falha de asset possui fallback sem quebrar CTA/estado comercial | failure E2E |
| PRO4-STORE-13 | hero, cards e feedback de saldo usam a mesma identidade visual `/coin.svg` para `campaign-credit` | visual/source review |
| PRO4-STORE-14 | glyph textual legado como `◈` não substitui `/coin.svg` como identidade visual primária | DOM/source negative assertion |

## Gates BLOCKER — integração de compra

As invariantes financeiras são avaliadas em `../../economy/EVAL.md`. Aqui validamos comportamento de interface e boundary.

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-BUY-01 | CTA `COMPRAR` existe somente quando backend indica offer adquirível | E2E/DOM |
| PRO4-BUY-02 | request da UI não envia `userId`, preço, moeda, saldo ou lista autoritativa de cosméticos | network/source inspection |
| PRO4-BUY-03 | pending de compra evita spam acidental da mesma interação | interaction E2E |
| PRO4-BUY-04 | sucesso atualiza saldo e ownership usando resposta autoritativa | E2E |
| PRO4-BUY-05 | saldo insuficiente produz feedback claro e preserva tela operável | E2E |
| PRO4-BUY-06 | erro de compra não transforma offer em possuída localmente | failure E2E |
| PRO4-BUY-07 | reload após compra confirma persistência real | browser E2E |
| PRO4-BUY-08 | quando saldo/valor gasto é mostrado após compra, `/coin.svg` continua sendo usado junto ao valor | E2E/visual |

## Gates BLOCKER — Reforçar Tesouraria

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-CASH-01 | seção existe ao final da Intendência quando packs são retornados | E2E/DOM |
| PRO4-CASH-02 | quantidade de créditos e BRL vêm do DTO | DB→DTO→DOM |
| PRO4-CASH-03 | CTA é `EM BREVE`, disabled ou semanticamente não adquirível | DOM/accessibility |
| PRO4-CASH-04 | mouse, teclado ou toque não iniciam checkout nem alteram saldo | E2E |
| PRO4-CASH-05 | UI não contém formulário de cartão/pagamento ou falsa confirmação | source/DOM negative |
| PRO4-CASH-06 | quantidade de `campaign-credit` usa `/coin.svg` e permanece visualmente distinta do preço em BRL | visual/E2E |

## Gates BLOCKER — Foundation e visual

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-FOUND-01 | Dossiê/Arsenal/Intendência controlam Foundation somente por API pública semântica | source inspection |
| PRO4-FOUND-02 | PROFILE não importa Three/R3F/Canvas/câmera | automated source inspection |
| PRO4-FOUND-03 | fallback sem WebGL mantém as três superfícies operáveis | fallback E2E/manual |
| PRO4-FOUND-04 | mudança de superfície não causa flicker/remount pesado evidente da cena | performance/visual |
| PRO4-VIS-01 | paleta permanece coerente com Home: verde/carvão, marfim, dourado e vermelho operacional | visual review |
| PRO4-VIS-02 | produtos/assets têm prioridade visual maior que ornamentação sem função | visual review |
| PRO4-VIS-03 | UI não assume aparência de dashboard corporativo genérico | review comparativo com visual-language |
| PRO4-VIS-04 | estado de foco, ownership, preço e erro é legível em contraste normal | accessibility/visual |
| PRO4-VIS-05 | `public/coin.svg` mantém escala, nitidez e enquadramento coerentes em shell, cards e packs | visual desktop/mobile |

## Gates BLOCKER — motion

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-MOTION-01 | transições principais usam preferencialmente transform/opacity | source/performance review |
| PRO4-MOTION-02 | não há loop visual pesado causando relayout/repaint contínuo perceptível | performance trace/manual |
| PRO4-MOTION-03 | `prefers-reduced-motion` remove parallax, float e sweeps contínuos | reduced-motion E2E |
| PRO4-MOTION-04 | reduced-motion preserva feedback de compra/equipagem por estado textual/visual estático | accessibility |
| PRO4-MOTION-05 | animações não bloqueiam input após seu estado final | interaction test |

## Gates BLOCKER — responsividade

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-RESP-01 | Dossiê principal é utilizável em 1440x900 sem desperdício estrutural de viewport | visual/manual |
| PRO4-RESP-02 | Arsenal e Store podem rolar conteúdo mantendo navegação/saldo acessíveis | desktop E2E |
| PRO4-RESP-03 | 390x844 possui shell de três superfícies operável por touch | mobile E2E |
| PRO4-RESP-04 | mobile não depende de hover | interaction review |
| PRO4-RESP-05 | Arsenal mobile reorganiza bays sem overflow horizontal acidental | 390x844 visual |
| PRO4-RESP-06 | Store mobile mantém preview, preço e CTA legíveis | 390x844 visual |
| PRO4-RESP-07 | inspection mobile usa sheet/painel que não aprisiona foco indevidamente | accessibility/manual |
| PRO4-RESP-08 | `/coin.svg` permanece legível sem dominar saldo/preço em 390x844 | mobile visual |

## Gates BLOCKER — acessibilidade monetária

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-A11Y-COIN-01 | saldo e preço continuam compreensíveis sem depender exclusivamente do desenho da moeda | screen reader/DOM |
| PRO4-A11Y-COIN-02 | quando `coin.svg` é decorativo, ele não gera anúncio redundante no leitor de tela | accessibility inspection |
| PRO4-A11Y-COIN-03 | quando o ícone participa do nome acessível, o nome equivalente é `Créditos de Campanha` | accessibility test |
| PRO4-A11Y-COIN-04 | falha visual do SVG não remove o valor numérico/textual do saldo ou preço | failure DOM test |

## Gates BLOCKER — autenticação e autorização preservadas

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-AUTH-01 | rotas próprias derivam usuário de `session.user.id` | code/integration |
| PRO3-AUTH-02 | nenhuma mutação usa `userId` do browser como ator | security test |
| PRO3-AUTH-03 | Route Handlers protegidos validam sessão independentemente do Proxy | route test |
| PRO3-AUTH-04 | acesso não autenticado possui redirect/401 coerente | E2E |
| PRO3-AUTH-05 | autorização segue deny-by-default | negative tests |

## Gates BLOCKER — identidade, privacidade e ausência de imagem

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-ID-01 | `profile.commanders` mantém vínculo 1:1 com `auth.user` | DB/schema |
| PRO3-ID-02 | handle continua único case-insensitive | DB integration |
| PRO3-ID-03 | usuário não edita perfil alheio | negative API |
| PRO3-ID-04 | título equipado precisa pertencer ao usuário | DB/service |
| PRO3-PRIV-01 | presença/atividade/histórico respeitam política persistida | integration |
| PRO3-PRIV-02 | privacidade é aplicada antes do DTO | security/source |
| PRO3-PRIV-03 | DTO público não contém email, ID interno, sessão, provider IDs, IP, player_session, wallet/inventory privados ou imagem OAuth | snapshot/security |
| PRO3-IMG-01 | `profile.*` não possui coluna/tabela autoritativa de avatar/retrato | schema review |
| PRO3-IMG-02 | DTOs/search/roster não contêm avatar/retrato/imagem de usuário | contract snapshot |
| PRO3-IMG-03 | imagem retornada por OAuth não é renderizada no Profile | auth/profile E2E |
| PRO3-IMG-04 | não existe endpoint/storage adapter de upload de imagem de perfil | source inspection |
| PRO3-IMG-05 | componentes de identidade não renderizam imagem de usuário | DOM/source negative |
| PRO3-IMG-06 | remoção de avatar resulta em composição intencional sem slot vazio | visual desktop/mobile |

## Gates BLOCKER — social

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-SOC-01 | usuário não solicita amizade a si próprio | API/DB |
| PRO3-SOC-02 | friendship não possui duplicata/inversão | constraint |
| PRO3-SOC-03 | não existem requests pendentes A→B e B→A simultâneos | concurrency/constraint |
| PRO3-SOC-04 | aceitar request é transacional e idempotente | integration/concurrency |
| PRO3-SOC-05 | somente destinatário aceita request | authorization |
| PRO3-SOC-06 | block impede novo pedido | integration |
| PRO3-SOC-07 | block resolve relação/pedidos conforme contrato | transaction test |
| PRO3-SOC-08 | busca continua sob demanda e limitada | API/architecture |
| PRO3-SOC-09 | busca não retorna dados privados/imagem de perfil | response snapshot |

## Gates BLOCKER — presença e atividade

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-PRES-01 | heartbeat exige sessão e atualiza apenas próprio usuário | API test |
| PRO3-PRES-02 | heartbeat renova TTL | Redis integration |
| PRO3-PRES-03 | ausência de heartbeat eventualmente resulta em offline | Redis integration |
| PRO3-PRES-04 | Redis indisponível resulta em `unavailable`, não `offline` | failure injection |
| PRO3-PRES-05 | PostgreSQL não recebe write a cada heartbeat | instrumentation |
| PRO3-PRES-06 | roster evita N chamadas HTTP por amigo | architecture/performance |
| PRO3-ACT-01 | browser não declara lobby/match como verdade | source inspection |
| PRO3-ACT-02 | atividade deriva de `game.players.user_id` + `game.rooms` | integration |
| PRO3-ACT-03 | waiting/order_roll→lobby, playing→match, ausência→idle | contract test |

## Gates BLOCKER — histórico

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO3-HIST-01 | histórico usa `game.*` real | integration |
| PRO3-HIST-02 | resultado deriva da partida real | integration |
| PRO3-HIST-03 | paginação usa LIMIT + cursor/keyset | query/source |
| PRO3-HIST-04 | histórico profundo não usa OFFSET | source inspection |
| PRO3-HIST-05 | snapshot histórico de nome/handle não muda após edição | integration |
| PRO3-HIST-06 | histórico não persiste/projeta imagem de perfil | schema/DTO |

## Gates BLOCKER — boundaries de dados

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO4-DATA-01 | React components não consultam SQL diretamente | source inspection |
| PRO4-DATA-02 | Profile usa Page/Route→Service→Repository→storage boundary | architecture review |
| PRO4-DATA-03 | ausência de fonte não vira lista vazia/zero/offline sintético | failure tests |
| PRO4-DATA-04 | Arsenal/Store usam contratos econômicos em vez de duplicar regras comerciais | contract/source |
| PRO4-DATA-05 | `/profile/[handle]` usa DTO público separado | security/source |
| PRO4-DATA-06 | associação visual `campaign-credit -> /coin.svg` pode permanecer estrutural no frontend sem transformar o cliente em autoridade econômica | contract/source review |

## Cenários obrigatórios

### Navegação e Dossiê

- `PRO4-S1`: visitante tenta `/profile`.
- `PRO4-S2`: usuário autenticado abre Dossiê e o shell mostra saldo real com `/coin.svg`.
- `PRO4-S3`: navegar Dossiê→Arsenal→Intendência→back/forward.
- `PRO4-S4`: editar display name/bio e recarregar.
- `PRO4-S5`: abrir e fechar edição sem perder dados.
- `PRO4-S6`: economia indisponível enquanto Dossiê/social/histórico permanecem utilizáveis.
- `PRO4-S7`: OAuth possui imagem, mas nenhuma imagem/URL aparece no Profile.

### Arsenal

- `PRO4-S8`: usuário somente com defaults vê quatro bays equipados.
- `PRO4-S9`: usuário com cosméticos adicionais filtra Ataque/Defesa/Neutro/Território.
- `PRO4-S10`: equipar item possuído atualiza bay.
- `PRO4-S11`: reload preserva equipagem.
- `PRO4-S12`: item não possuído não aparece como inventário/equipável.
- `PRO4-S13`: asset de preview falha e fallback permanece utilizável.

### Store

- `PRO4-S14`: hero usa offer retornada pelo backend e preço usa `/coin.svg`.
- `PRO4-S15`: catalog renderiza todas as offers retornadas sem conhecimento de slug.
- `PRO4-S16`: preço no banco muda e DOM acompanha sem alterar o ícone canônico da moeda.
- `PRO4-S17`: offer 0/N mostra comprar.
- `PRO4-S18`: offer parcial mostra `x/N POSSUÍDOS` sem desconto inventado.
- `PRO4-S19`: offer N/N mostra possuído.
- `PRO4-S20`: abrir inspection e trocar previews não altera estado econômico.
- `PRO4-S21`: compra bem-sucedida atualiza saldo/ownership e novo saldo continua acompanhado de `/coin.svg`.
- `PRO4-S22`: saldo insuficiente mostra erro e não altera estado local indevidamente.
- `PRO4-S23`: reload após compra confirma estado persistido.

### Packs BRL

- `PRO4-S24`: packs retornados aparecem no fim da loja e quantidade de créditos usa `/coin.svg`.
- `PRO4-S25`: BRL é formatado a partir de centavos persistidos e visualmente distinto da moeda do jogo.
- `PRO4-S26`: CTA não é acionável como checkout.
- `PRO4-S27`: botão global `+` leva à seção e não altera saldo.

### Social/presença/histórico preservados

- `PRO4-S28`: busca por handle e amizade continuam funcionando.
- `PRO4-S29`: Redis indisponível mostra presença unavailable.
- `PRO4-S30`: usuário em partida mantém atividade derivada correta.
- `PRO4-S31`: partida concluída aparece no histórico.
- `PRO4-S32`: edição posterior de nome não altera snapshot histórico.

### Visual/responsivo

- `PRO4-S33`: 1440x900 Dossiê com wallet e `coin.svg` legíveis.
- `PRO4-S34`: 1440x900 Arsenal com inventário suficiente para scroll.
- `PRO4-S35`: 1440x900 Intendência com hero, catálogo, inspection e preços com `coin.svg`.
- `PRO4-S36`: 390x844 Dossiê com saldo e ícone sem overflow.
- `PRO4-S37`: 390x844 Arsenal.
- `PRO4-S38`: 390x844 Intendência e bottom sheet com preço/ícone legíveis.
- `PRO4-S39`: reduced-motion nas três superfícies.
- `PRO4-S40`: Foundation/WebGL fallback nas três superfícies.
- `PRO4-S41`: R2 indisponível, mas `/coin.svg` continua disponível e valores econômicos permanecem representáveis.

## Testes de concorrência preservados

Para domínio Profile/social executar ao menos:

1. A→B e B→A simultaneamente;
2. dois `accept` simultâneos;
3. `accept` concorrente com `block`;
4. `remove friend` repetido.

Concorrência de purchase/wallet/inventory é avaliada exclusivamente por `../../economy/EVAL.md`.

## Matriz visual obrigatória

Capturar e revisar, no mínimo:

| Superfície | 1440x900 | 390x844 | reduced-motion | fallback |
| --- | --- | --- | --- | --- |
| Dossiê | obrigatório | obrigatório | obrigatório | obrigatório |
| Arsenal | obrigatório | obrigatório | obrigatório | obrigatório |
| Intendência | obrigatório | obrigatório | obrigatório | obrigatório |

Store adicionalmente deve possuir evidência dos estados:

- comprável com `/coin.svg` + preço;
- possuído;
- ownership parcial;
- saldo insuficiente;
- preview indisponível;
- pack BRL inativo com `/coin.svg` para quantidade de créditos.

Arsenal deve possuir evidência de:

- defaults;
- item adicional possuído;
- item equipado;
- filtro de slot;
- preview indisponível.

## Score / 100

Todos os BLOCKERs são obrigatórios. O score mede qualidade adicional:

- 20 — arquitetura do shell e navegação;
- 15 — Dossiê e aproveitamento de espaço;
- 15 — Arsenal e personalização;
- 15 — Intendência e integração econômica;
- 10 — identidade/privacidade/social/histórico preservados;
- 10 — responsividade e acessibilidade, incluindo representação da moeda;
- 5 — Foundation e fallback;
- 5 — motion/performance;
- 5 — estados de erro e qualidade de evidência.

Meta: **>= 90/100**.

## Critério de aprovação

A PROFILE V4 é aprovada somente quando:

- todos os gates `PRO4-*` e gates preservados `PRO3-*` estiverem verdes;
- todos os BLOCKERs econômicos aplicáveis estiverem verdes em `../../economy/EVAL.md`;
- a antiga Mesa de Comando estiver ausente da composição principal;
- as três superfícies tiverem evidência desktop/mobile/reduced-motion/fallback;
- wallet, preço de offers e packs usarem `/coin.svg` como representação visual canônica de `campaign-credit`;
- a representação textual/acessível de saldo e preço permanecer correta;
- compra com créditos estiver integrada pela boundary correta;
- packs em BRL permanecerem demonstrativos e não transacionais;
- nenhuma imagem de perfil tiver sido reintroduzida.

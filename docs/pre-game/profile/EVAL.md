# EVAL — Perfil / Quartel do Comandante

Avaliar conforme `../quality-standard.md` e `../traceability.md`.

## Gates BLOCKER

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO-01 | nenhum rank/stat/saldo social/comercial é apresentado como real sem fonte | data-source review |
| PRO-02 | loading, parcial, vazio social, vazio histórico e erro possuem estados explícitos | state coverage |
| PRO-03 | nenhum identificador sensível/interno é exibido | inspection/security review |
| PRO-04 | conteúdo principal é legível e utilizável sem WebGL | fallback/manual |
| PRO-05 | mobile 390x844 não depende de hover/perspectiva | touch/manual |
| PRO-06 | reduced-motion preserva hierarquia e mudança de estação | snapshot/manual |
| PRO-07 | cada dado possui `source`/availability ou equivalente auditável | contract review |
| PRO-08 | guest/auth preserva comportamento vigente | regression |
| PRO-09 | histórico é limitado e possui continuação explícita | contract/performance |
| PRO-10 | retrato/insígnia mantém leitura desktop/mobile/fallback | visual |
| PRO-11 | nome e título são semanticamente distintos | DOM/accessibility |
| PRO-12 | estados vazios continuam parecendo parte do Quartel | visual review |
| PRO-13 | duas moedas têm símbolo, label e tratamento distintos | visual/DOM |
| PRO-14 | saldo indisponível não é convertido para zero | contract test |
| PRO-15 | Rede de Comando cobre amigos, busca, recentes e vazio | state/interaction |
| PRO-16 | busca social é sob demanda e não carrega diretório global | architecture review |
| PRO-17 | presença social possui equivalente textual | accessibility |
| PRO-18 | Intendência não simula compra persistida inexistente | interaction review |
| PRO-19 | preço identifica moeda por contrato | data/DOM |
| PRO-20 | estação ativa controla cena somente pela API pública da Foundation | source inspection |
| PRO-21 | PROFILE não importa Three/R3F/Canvas/câmera | automated inspection |
| PRO-22 | uso principal desktop cabe em 1440x900 sem scroll global obrigatório | visual/manual |
| PRO-23 | mobile reorganiza para Terminal de Campo com estação única expandida | 390x844 visual |
| PRO-24 | fallback WebGL mantém Dossiê, Tesouraria, Rede, Campanhas e Intendência operáveis | fallback/manual |

## Score / 100

- 25 — integridade, privacidade e contratos de dados;
- 20 — identidade visual única / Quartel do Comandante;
- 15 — Dossiê + Tesouraria;
- 15 — Rede de Comando;
- 10 — Livro de Campanha;
- 5 — Intendência;
- 10 — mobile, acessibilidade, performance e fallback.

Aprovação: >= 85 + todos os BLOCKERs.

## Cenários obrigatórios

- `PRO-S1`: visitante/sem identidade;
- `PRO-S2`: snapshot local completo;
- `PRO-S3`: carteira indisponível;
- `PRO-S4`: histórico vazio;
- `PRO-S5`: social vazio;
- `PRO-S6`: busca social com nenhum resultado;
- `PRO-S7`: busca social com resultado;
- `PRO-S8`: histórico com continuação (`hasMore`/cursor);
- `PRO-S9`: Intendência sem produtos;
- `PRO-S10`: erro de carregamento;
- `PRO-S11`: reduced-motion;
- `PRO-S12`: WebGL indisponível;
- `PRO-S13`: mobile 390x844;
- `PRO-S14`: desktop 1440x900.

## Auditoria de dados

Para cada valor numérico, presença, relação social ou preço visível, registrar origem no contrato. Dados hardcoded desta fase devem usar `source: "local-static"`; fixtures de EVAL usam `evaluation-fixture`.

`0`, `offline`, `sem amigos`, `sem partidas` e `sem itens` são dados válidos somente quando a fonte correspondente estiver disponível e retornar esses estados. Ausência de fonte é `unavailable`, não zero/vazio inventado.

## Interaction regression

Validar:

1. seleção de `dossier`, `treasury`, `network`, `campaigns`, `quartermaster`;
2. foco da Foundation muda por diretiva sem import de renderer;
3. busca social não bloqueia outras estações;
4. abrir/fechar Dossiê da Operação não perde estação ativa;
5. selecionar item da Intendência não executa compra;
6. teclado percorre todas as ações em ordem lógica;
7. touch targets funcionam em 390x844.

## Visual regression

Capturar ao menos 1440x900 e 390x844 para:

- `dossier`;
- `treasury`;
- `network`;
- `campaigns`;
- `quartermaster`;
- `empty-social`;
- `empty-history`;
- `error`;
- `reduced-motion`;
- `fallback`.

O resultado MUST parecer um único Quartel militar, não cinco dashboards/abas independentes.

## Gate de rastreabilidade

Todos os conceitos `CORE` já associados ao Perfil em `../traceability.md` permanecem obrigatórios. O PR V2 deve registrar adicionalmente Dossiê, Tesouraria, Rede de Comando, Livro de Campanha, Intendência e Mesa de Comando como conceitos centrais do redesign.
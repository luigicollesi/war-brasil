# EVAL — Perfil / Salão de Comando

Avaliar conforme `../quality-standard.md` e `../traceability.md`.

## Gates BLOCKER

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| PRO-01 | nenhuma estatística, patente, ranking ou conquista é inventada | data-source review |
| PRO-02 | loading, vazio, parcial, sem progressão e erro possuem estados explícitos | state coverage |
| PRO-03 | nenhum identificador sensível/interno é exibido | inspection/security review |
| PRO-04 | informações principais são legíveis sem 3D | fallback/manual |
| PRO-05 | mobile não depende de perspectiva/hover | 390x844 touch |
| PRO-06 | reduced-motion mantém conteúdo/hierarquia | snapshot/manual |
| PRO-07 | dado exibido possui origem real identificável ou é marcado indisponível | contract/data review |
| PRO-08 | guest/auth preserva comportamento vigente e não inventa fluxo novo | regression/inspection |
| PRO-09 | histórico volumoso não exige carregamento ilimitado para renderizar a página | inspection/performance |
| PRO-10 | Insígnia mantém leitura em desktop/mobile/fallback | visual |
| PRO-11 | medalhas/conquistas têm equivalente textual quando existirem | accessibility review |
| PRO-12 | estado vazio continua parecendo Salão de Comando, não dashboard quebrado | visual review |

## Score / 100

- 30 — integridade, privacidade e clareza dos dados;
- 20 — sensação de prestígio/Salão de Comando;
- 15 — Insígnia e hierarquia visual;
- 15 — estados vazio/parcial/erro/sem progressão;
- 10 — mobile/acessibilidade;
- 10 — performance/fallback.

Aprovação: >= 85 + todos os BLOCKERs.

## Cenários obrigatórios

- `PRO-S1`: visitante/sem perfil quando aplicável;
- `PRO-S2`: perfil com poucos dados;
- `PRO-S3`: perfil completo conforme backend disponível;
- `PRO-S4`: histórico vazio;
- `PRO-S5`: sistema de progressão inexistente/indisponível;
- `PRO-S6`: erro de carregamento;
- `PRO-S7`: volume grande de histórico, se suportado;
- `PRO-S8`: reduced-motion;
- `PRO-S9`: WebGL indisponível;
- `PRO-S10`: mobile 390x844.

## Auditoria de dados

Para cada valor numérico ou estado de conquista visível, o PR SHOULD registrar a origem (campo/contrato/computação). Placeholder visual MUST ser distinguível de dado real.

## Visual regression

Capturar 1440x900 e 390x844:

`guest`, `partial-data`, `loaded`, `empty-history`, `no-progression-system`, `error`, `reduced-motion`, `fallback`.

O resultado MUST parecer espaço de reconhecimento/comando e não painel de analytics. Seguir `../quality-standard.md`.

## Gate de rastreabilidade

Todos os conceitos `CORE` associados ao Perfil em `../traceability.md` MUST permanecer presentes.

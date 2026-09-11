# EVAL — Perfil / Salão de Comando

## Gates BLOCKER

| ID | Critério |
| --- | --- |
| PRO-01 | nenhuma estatística/patente é inventada quando não há dado |
| PRO-02 | loading, vazio, parcial e erro possuem estados explícitos |
| PRO-03 | nenhum identificador sensível/interno é exibido |
| PRO-04 | informações principais são legíveis sem 3D |
| PRO-05 | mobile não depende de perspectiva/hover |
| PRO-06 | reduced-motion mantém conteúdo e hierarquia |

## Score / 100

- 30 — sensação de prestígio/Salão de Comando;
- 20 — integridade e clareza dos dados;
- 15 — hierarquia visual;
- 15 — estados vazio/parcial/erro;
- 10 — mobile/acessibilidade;
- 10 — performance.

Aprovação: >= 85 + BLOCKERs.

## Cenários

`PRO-S1` visitante/sem perfil.  
`PRO-S2` perfil com poucos dados.  
`PRO-S3` perfil completo conforme backend disponível.  
`PRO-S4` histórico vazio.  
`PRO-S5` erro de carregamento.  
`PRO-S6` reduced-motion/mobile.

## Visual regression

Snapshotar `guest`, `partial-data`, `loaded`, `empty-history`, `error` em 1440x900 e 390x844. O resultado deve parecer um espaço de reconhecimento militar e não painel de analytics.

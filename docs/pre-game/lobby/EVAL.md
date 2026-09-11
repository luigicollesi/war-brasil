# EVAL — Lobby

## Gates BLOCKER

| ID | Critério |
| --- | --- |
| LOB-01 | entrar/sair de jogador atualiza a UI sem reload manual |
| LOB-02 | ready/unready permanece sincronizado entre clientes |
| LOB-03 | facção/cor continuam respeitando regras atuais |
| LOB-04 | início ocorre uma única vez quando condições atuais são satisfeitas |
| LOB-05 | reconexão/erro têm estado textual e recuperável |
| LOB-06 | código da sala é legível e copiável |
| LOB-07 | 2 a 6 jogadores são representáveis em desktop e mobile |
| LOB-08 | cena visual não é fonte paralela de verdade do lobby |

## Score / 100

- 30 — confiabilidade multiplayer;
- 20 — sensação de briefing/estações de comando;
- 15 — legibilidade e hierarquia;
- 15 — responsive para 2–6 jogadores;
- 10 — transição de autorização;
- 10 — acessibilidade/performance.

Aprovação: >= 85 + BLOCKERs.

## Cenários obrigatórios

`LOB-S1` host sozinho.  
`LOB-S2` dois jogadores, um pronto.  
`LOB-S3` seis jogadores.  
`LOB-S4` jogador entra durante configuração.  
`LOB-S5` jogador sai.  
`LOB-S6` ready/unready rápido.  
`LOB-S7` reconexão.  
`LOB-S8` todos prontos -> início.

## Visual regression

Estados: 1 jogador, 2 jogadores, 6 jogadores, todos prontos, reconnecting/error; 1440x900 e 390x844.

# Authentication / Command Access

Documentos desta trilha:

- `SPEC.md` — fluxo funcional, segurança, cookies, providers e fronteira server/client;
- `EVAL.md` — gates de autenticação, secrets, OAuth, modal, abuso e migrations;
- `DATABASE-PLAN.md` — arquitetura PostgreSQL preparada para substituir todas as fixtures atuais da PROFILE;
- `DATABASE-EVAL.md` — gates de integridade, concorrência, history/social/economy e performance do modelo de dados.

## Relação com PROFILE

A implementação de autenticação MUST considerar `../profile/SPEC.md`, `../profile/EVAL.md`, `../profile/IMPLEMENTATION-PLAN.md` e o contrato `src/lib/profile/profile-command-contract.ts`.

`DATABASE-PLAN.md` e `DATABASE-EVAL.md` são normativos para qualquer PR que troque `local-static`/`evaluation-fixture` da PROFILE por dados persistidos.

A integração não está concluída enquanto Dossiê, Tesouraria, Rede de Comando, Livro de Campanha e Intendência não tiverem fontes reais/derivações auditáveis ou estados `unavailable` explícitos.

## Regra de source of truth

- auth/session/provider -> `auth`;
- identidade pública/loadout/inventário cosmético -> `profile`;
- amizades/presença -> `social`;
- moedas/wallet/ledger -> `economy`;
- catálogo/preço/showcase -> `catalog`;
- fatos de partida/histórico -> `game`;
- dados derivados não devem ganhar tabela duplicada sem necessidade medida.

Em particular, `mutualContacts`, `totalFriends`, `recentContacts`, `isFriend`, resultado da partida e duração não devem ser persistidos como segunda fonte de verdade no primeiro modelo.

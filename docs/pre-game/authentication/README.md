# Authentication / Command Access

Documentos desta trilha:

- `SPEC.md` — fluxo funcional, segurança, cookies, providers e fronteira server/client;
- `EVAL.md` — gates de autenticação, provider behavior, secrets, OAuth, modal, abuso e migrations;
- `PROVIDER-STRATEGY.md` — decisão de providers orientada a jogos: Google + Apple + Discord no launch, passkeys pós-login e critérios para Microsoft/Steam/Twitch/Epic;
- `DATABASE-PLAN.md` — arquitetura PostgreSQL preparada para substituir todas as fixtures atuais da PROFILE;
- `DATABASE-EVAL.md` — gates de integridade, concorrência, history/social/economy e performance do modelo de dados.

## Providers de launch

```text
credentials
Google
Apple
Discord
```

GitHub não faz parte do launch. A conta War-Brasil é a identidade principal; providers são credenciais vinculadas.

Providers de plataforma/comunidade adicionais entram somente quando houver caso real de produto e atualização explícita do SPEC/EVAL.

## Relação com PROFILE

A implementação de autenticação MUST considerar `../profile/SPEC.md`, `../profile/EVAL.md`, `../profile/IMPLEMENTATION-PLAN.md` e `src/lib/profile/profile-command-contract.ts`.

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

Provider email também não é identidade pública: `handle`/`displayName` continuam pertencendo a `profile.commanders`, e provider account ID/sub é a chave externa usada pela autenticação.
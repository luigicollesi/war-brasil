# Authentication / Command Access

Documentos desta trilha:

- `SPEC.md` — fluxo funcional, segurança, cookies, quatro métodos de autenticação e fronteira server/client;
- `EVAL.md` — gates de autenticação, verificação de email, providers, secrets, modal, abuso e migrations;
- `PROVIDER-STRATEGY.md` — contrato estrito de launch para Google, Apple, Discord e Email + senha;
- `EMAIL-VERIFICATION-FLOW.md` — ciclo detalhado de cadastro credentials → email → confirmação → login, baseado na UX do Contrapista;
- `DATABASE-PLAN.md` — arquitetura PostgreSQL preparada para substituir as fixtures atuais da PROFILE;
- `DATABASE-EVAL.md` — gates de integridade, concorrência, history/social/economy e performance do modelo de dados.

## Métodos de launch

```text
Google
Apple
Discord
Email + senha
```

Esse conjunto é fechado para a primeira implementação. Nenhum quinto provider deve ser configurado ou mostrado sem atualização explícita dos contratos.

A conta War-Brasil é a identidade principal; providers são credenciais vinculadas.

## Email + senha

Credentials segue a experiência do Contrapista para criação de conta:

```text
cadastro
  ↓
envia email de verificação
  ↓
verification-pending
  ↓
SEM sessão
  ↓
clique em link válido por 1 hora
  ↓
email confirmado
  ↓
retorno à Home
  ↓
login normal
  ↓
onboarding se necessário
```

A experiência é reaproveitada, mas a implementação interna não copia o schema custom do Contrapista. Better Auth permanece dono do usuário, password hash e verification token.

Normas centrais:

- `requireEmailVerification = true` ou equivalente da versão pinada;
- envio automático no signup;
- nenhuma sessão no signup;
- nenhum auto-login após verification;
- token de 1 hora;
- reenvio explícito e rate-limited;
- duplicate signup/reenvio não podem enumerar contas;
- password reset real;
- email delivery atrás de boundary server-only `sendAuthEmail()`;
- nenhuma tabela War-Brasil paralela de pending credentials/verification.

## Relação com PROFILE

A implementação de autenticação MUST considerar `../profile/SPEC.md`, `../profile/EVAL.md`, `../profile/IMPLEMENTATION-PLAN.md` e `src/lib/profile/profile-command-contract.ts`.

Sessão autenticada não significa automaticamente perfil pronto. Antes de abrir o Comando, `profile.commanders` precisa possuir `handle` e `display_name` válidos; caso contrário o usuário segue para onboarding.

`DATABASE-PLAN.md` e `DATABASE-EVAL.md` são normativos para qualquer PR que troque `local-static`/`evaluation-fixture` da PROFILE por dados persistidos.

## Source of truth

- auth/session/provider/verification -> `auth` / Better Auth;
- identidade pública/loadout/inventário cosmético -> `profile`;
- amizades/presença -> `social`;
- moedas/wallet/ledger -> `economy`;
- catálogo/preço/showcase -> `catalog`;
- fatos de partida/histórico -> `game`.

Dados derivados não ganham tabela duplicada sem necessidade medida. `mutualContacts`, `totalFriends`, `recentContacts`, `isFriend`, resultado e duração de partida continuam derivados conforme `DATABASE-PLAN.md`.

Provider email não é identidade pública: `handle`/`displayName` pertencem a `profile.commanders`, e provider account ID/sub é a identidade externa usada pela autenticação.

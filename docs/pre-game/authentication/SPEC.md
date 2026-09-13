# SPEC — Authentication / Command Access

**ID:** PRE-AUTH  
**Escopo:** identidade de conta, restauração de sessão, login/cadastro, providers, gate de acesso ao comando, proteção server-side e fronteira de segredos.  
**Integração inicial:** Home (`ENTRAR NO COMANDO`) → matchmaking/lobby/profile/game.  
**Target técnico inicial:** Better Auth 1.7.x fixado em versão validada pelo CI; PostgreSQL continua sendo a fonte persistente.  
**Provider strategy:** `PROVIDER-STRATEGY.md`.  
**Modelo de dados:** `DATABASE-PLAN.md`.

Este documento segue `../quality-standard.md`. Autenticação é estado de negócio e MUST permanecer independente da timeline/renderer da Foundation.

## 1. Objetivo

Ao clicar em `ENTRAR NO COMANDO`, a aplicação MUST reutilizar uma sessão válida já persistida pelo navegador. Se a sessão não existir, estiver expirada, revogada ou for inválida, a Home MUST abrir um modal de autenticação sem desmontar a cena.

Fluxo normativo:

```text
ENTRAR NO COMANDO
        ↓
revalidar/consultar sessão
   ┌────┴─────┐
 válida      ausente/inválida
   ↓             ↓
perfil público? AUTH MODAL
   │             ↓
   ├─ completo   login/cadastro/provider
   │    ↓              ↓
   │ command-open   sessão válida
   │                    ↓
   └─ incompleto ← profile-onboarding
```

A checagem da Home é UX. Segurança MUST ser aplicada novamente no servidor em cada recurso protegido.

## 2. Decisões arquiteturais

### 2.1 Biblioteca

A implementação SHOULD usar Better Auth em vez de autenticação própria.

MUST:

- manter a instância server-side de auth em módulo `server-only` ou equivalente;
- montar handlers sob `/api/auth/*`;
- usar PostgreSQL para usuários/sessões/contas/verificações;
- manter migrations sob a infraestrutura gerenciada do War-Brasil;
- não executar criação/alteração de schema implicitamente em requests de produção;
- fixar explicitamente a versão do pacote durante a primeira implementação;
- revisar changelog/schema antes de qualquer upgrade.

A CLI do Better Auth MAY gerar SQL como entrada para revisão, mas a migration aplicada ao projeto MUST permanecer versionada e testável.

### 2.2 Conta, provider e assento são entidades diferentes

```text
Provider identity       Conta War-Brasil         Assento/sessão de jogo
Google/Apple/Discord -> auth.user.id        <- game.players.user_id
                                              game.players.player_session
                                              war_brasil_player
```

Regras:

- `auth.user.id` identifica a conta interna;
- provider account ID/sub identifica uma credencial externa vinculada;
- `player_session` identifica o assento/instância de jogo;
- `war_brasil_player` sozinho MUST NOT autenticar uma conta;
- email, provider username, SteamID futuro ou user ID público MUST NOT ser aceitos como bearer credential;
- comandos protegidos SHOULD validar conta + assento quando a integração chegar ao jogo.

## 3. Providers normativos

A estratégia completa está em `PROVIDER-STRATEGY.md`.

### 3.1 Launch / Tier 1

O modal inicial MUST suportar:

- email + senha;
- **Google**;
- **Apple**;
- **Discord**.

GitHub MUST NOT ser apresentado nem configurado como provider de launch.

### 3.2 Tier posterior

- Passkey/WebAuthn SHOULD ser oferecido como método pós-login/retorno rápido após onboarding;
- Microsoft MAY entrar em fase posterior quando houver valor Windows/Xbox medido;
- Twitch MAY entrar somente com caso real de streaming/comunidade;
- Steam SHOULD ser inicialmente identidade de plataforma vinculada/futura, não provider web launch;
- Epic/EOS só entra quando o produto adotar a plataforma/serviços correspondentes.

Novo provider exige alteração explícita de `PROVIDER-STRATEGY.md`, deste SPEC e do EVAL.

## 4. Contrato por provider

### 4.1 Google

MUST:

- usar provider built-in Better Auth;
- usar somente scopes de identidade básica;
- tratar provider `sub/accountId` como identificador externo estável;
- não pedir Drive/Calendar/Contacts ou scopes adicionais durante login;
- nunca usar email como autorização ou handle público.

### 4.2 Apple

MUST:

- usar provider built-in Better Auth;
- configurar Service ID para web;
- manter private key Apple exclusivamente server-side;
- gerar client-secret JWT dinamicamente no servidor quando possível;
- não depender de `localhost`/HTTP para teste real Apple; usar HTTPS válido;
- aceitar relay/private email como email válido quando fornecido;
- persistir corretamente o email recebido na primeira autorização;
- suportar logins posteriores quando Apple não reenviar `email`;
- nunca sobrescrever email real previamente persistido com fallback sintético;
- usar provider `sub/accountId` como identidade externa.

`https://appleid.apple.com` MAY ser trusted origin especificamente exigida pelo provider. Isso não autoriza origins adicionais.

### 4.3 Discord

MUST:

- usar provider built-in Better Auth;
- limitar scopes a identidade básica (`identify` + `email` quando necessário);
- não pedir `guilds`, bot, activities, connections ou permissões comunitárias só para login;
- usar Discord ID/snowflake como provider account ID;
- tratar username/global name/avatar apenas como sugestão/fallback de onboarding.

Contas phone-only podem não fornecer email. Se a biblioteca exigir fallback interno:

- usar identificador estável do provider;
- usar domínio reservado `.invalid` ou representação inequivocamente não-entregável;
- marcar/tratar o valor como non-contact;
- não enviar verification/reset/magic-link para esse valor;
- não exibir o placeholder;
- não usá-lo para account linking implícito.

Ausência de email Discord não deve, sozinha, converter uma identidade OAuth válida em identidade pública incompleta; `handle` e `displayName` continuam sendo resolvidos em `profile.commanders`.

## 5. Account linking

A conta War-Brasil é a entidade principal. Providers são métodos vinculados.

Política inicial desejada:

```text
accountLinking.enabled = true
accountLinking.disableImplicitLinking = true
accountLinking.allowDifferentEmails = true
accountLinking.trustedProviders = []
accountLinking.updateUserInfoOnLink = false
accountLinking.allowUnlinkingAll = false
```

MUST:

- não mesclar contas silenciosamente apenas porque emails coincidem;
- permitir linking explícito somente a partir de uma sessão já autenticada;
- permitir providers com emails diferentes quando o usuário autenticado autoriza explicitamente;
- não permitir que linking sobrescreva handle/display name/loadout do jogo;
- impedir unlink do último método de acesso;
- manter `trustedProviders` vazio no launch.

Provider externo é identificado conceitualmente por `(providerId, providerAccountId)`, nunca por email.

## 6. Banco de dados

O schema de autenticação SHOULD usar `auth`. O modelo completo da PROFILE segue `DATABASE-PLAN.md`.

Core mínimo Better Auth:

```text
auth
├── user
├── session
├── account
├── verification
└── rate_limit   # quando persistido
```

`game.players` receberá `user_id UUID NULL REFERENCES auth.user(id)` com rollout compatível com bots/legado.

Campos de PROFILE, wallet, social, presença e cosméticos MUST permanecer nos seus schemas de domínio; não inflar `auth.user`.

## 7. Sessão

Sessão MUST usar cookie seguro gerenciado pela biblioteca.

MUST:

- `HttpOnly`;
- `Secure` em produção;
- `SameSite=Lax` ou mais restritivo se compatível;
- host-only por padrão;
- `Path=/`;
- nunca persistir session token em localStorage/sessionStorage/IndexedDB;
- aceitar logout/revogação server-side;
- tratar sessão ausente/expirada/revogada como não autenticada.

Duração/cache são constantes versionadas em código, não toggles livres de ambiente.

## 8. Fluxo da Home

A Home MAY pré-carregar o estado leve de sessão durante a Genesis.

`ENTRAR NO COMANDO`:

```text
idle
 ↓ click
checking-session
 ├── authenticated + profile complete → command-open
 ├── authenticated + profile incomplete → profile-onboarding
 ├── unauthenticated → auth-modal
 └── recoverable error → auth-modal/error state
```

MUST:

- assentar a cerimônia visual sem esperar auth;
- não ler cookie HttpOnly via JavaScript;
- não inferir auth pela existência de `war_brasil_player`;
- não abrir `command-open` antes de sessão válida e requisitos mínimos de onboarding;
- após login bem-sucedido continuar sem reload completo quando tecnicamente possível;
- funcionar em reduced-motion e fallback WebGL.

## 9. Modal de autenticação

O modal SHOULD reutilizar a estrutura de interação do Contrapista, mas com identidade visual War-Brasil.

Hierarquia recomendada:

1. Google;
2. Apple;
3. Discord;
4. divisor;
5. email + senha;
6. cadastro/recuperação.

A UI MUST NOT virar uma parede de providers. Tier 2 não aparece no launch.

MUST possuir:

- pending explícito;
- erro genérico de credenciais inválidas;
- cancelamento/erro OAuth recuperável;
- focus trap;
- `role="dialog"`/`aria-modal="true"` ou primitive equivalente;
- restauração de foco;
- bloqueio de overflow adequado;
- mobile sem overflow horizontal;
- navegação completa por teclado;
- branding/button treatment compatível com exigências dos providers.

## 10. Cadastro e email/senha

MUST:

- normalizar email no servidor;
- usar password hashing suportado pela solução auth;
- nunca persistir/logar senha em texto puro;
- exigir verificação de email antes de liberar recursos dependentes de email;
- usar reset token expirável e single-use;
- responder reset/verification sem enumeração de conta;
- convergir credentials, Google, Apple e Discord para o mesmo onboarding público (`profile.commanders`).

Credentials MAY coletar `displayName`/`handle` no mesmo fluxo visual, mas provisionamento final MUST usar a mesma boundary de onboarding dos providers sociais.

## 11. Passkeys

Passkeys SHOULD entrar após o primeiro corte funcional de auth.

MUST, quando habilitadas:

- usar plugin oficial Better Auth/WebAuthn;
- validar RP ID e origin;
- não exigir passkey como único método de recuperação;
- oferecer registro apenas após identidade interna autenticada;
- não serializar challenge/segredo fora do fluxo esperado.

Passkey é método da conta War-Brasil, não identidade pública do jogador.

## 12. Rotas protegidas

Inicialmente:

- `/` — público;
- `/rules` — público;
- `/matchmaking` — autenticado;
- `/profile` — autenticado;
- lobby/game — autenticados;
- APIs mutáveis de sala/jogo — validação server-side conforme rollout.

Proxy/middleware MAY melhorar UX, mas presença de cookie nunca é autorização suficiente. Operações sensíveis MUST validar sessão via API server-side da solução auth.

## 13. Fronteira de ambiente e segredos

### 13.1 Regra principal

A allowlist pública específica de auth é **vazia**.

Nenhuma variável auth `NEXT_PUBLIC_*` pode ser introduzida sem mudança explícita de SPEC/EVAL.

### 13.2 Server-only — launch

| Variável | Classe | Quando exigida | Browser? |
| --- | --- | --- | --- |
| `DATABASE_URL` | segredo | sempre | **NUNCA** |
| `BETTER_AUTH_SECRET` | segredo crítico | sempre | **NUNCA** |
| `BETTER_AUTH_SECRETS` | segredo/rotação | opcional | **NUNCA** |
| `BETTER_AUTH_URL` | config server | produção | **NÃO** |
| `GOOGLE_CLIENT_ID` | provider ID | Google | **NÃO** |
| `GOOGLE_CLIENT_SECRET` | segredo | Google | **NUNCA** |
| `APPLE_CLIENT_ID` | provider ID/Service ID | Apple | **NÃO** |
| `APPLE_TEAM_ID` | provider config | Apple | **NÃO** |
| `APPLE_KEY_ID` | provider config | Apple | **NÃO** |
| `APPLE_PRIVATE_KEY` | segredo crítico | Apple | **NUNCA** |
| `APPLE_APP_BUNDLE_IDENTIFIER` | provider config | fluxo nativo Apple, se usado | **NÃO** |
| `DISCORD_CLIENT_ID` | provider ID | Discord | **NÃO** |
| `DISCORD_CLIENT_SECRET` | segredo | Discord | **NUNCA** |
| `AUTH_ALLOWED_HOSTS` | config server | multi-host, se usado | **NÃO** |
| `AUTH_EMAIL_FROM` | config server | email transacional | **NÃO** |
| `<EMAIL_PROVIDER>_API_KEY`/`SMTP_URL` | segredo | provider de email | **NUNCA** |

`BETTER_AUTH_SECRET` MUST ter pelo menos 32 caracteres de alta entropia.

### 13.3 Não criar antecipadamente

Enquanto os providers correspondentes não estiverem habilitados, MUST NOT existir configuração operacional para:

```text
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET
TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET
STEAM_WEB_API_KEY
EPIC_*
```

Variáveis entram no mesmo PR que habilita o provider e seus gates.

### 13.4 O que não vira env inicialmente

Continuam versionados em código:

- duração/cache de sessão;
- nomes/prefixo de cookies;
- SameSite/HttpOnly policy;
- rotas protegidas;
- password policy;
- rate limits normais;
- scopes OAuth;
- provider tier/ordem visual;
- account-linking policy;
- trusted provider list;
- nomes de tabelas/schema.

## 14. Segredos que nunca cruzam server → browser

BLOCKER se aparecerem em JS client, HTML, RSC/Flight, JSON client, console browser, source map público ou storage:

- `DATABASE_URL`/credenciais DB;
- Better Auth secrets;
- Google/Discord client secrets;
- Apple private key ou client-secret JWT gerado;
- email provider/SMTP credentials;
- password/hash;
- session token bruto fora do cookie HttpOnly esperado;
- verification/reset token fora do canal necessário;
- OAuth access/refresh/ID tokens;
- realtime/worker signing secrets;
- stack/SQL errors com credenciais.

Provider IDs públicos por natureza continuam server-only por política de minimização, já que o client escolhido não precisa deles.

## 15. Dados permitidos no cliente

O browser MAY receber somente dados mínimos de UX autenticada, por exemplo:

```ts
type ClientAuthUser = {
  id: string;
  displayName: string | null;
  image: string | null;
  email?: string;
};
```

Regras:

- user ID não é segredo, mas não autoriza nada isoladamente;
- email só chega a superfícies que realmente precisam dele;
- provider account IDs não precisam ser expostos na Home;
- provider tokens/hashes/secrets nunca entram em `ClientAuthUser`;
- placeholder `.invalid` nunca é mostrado como email real.

## 16. Import boundaries

Estrutura alvo:

```text
src/lib/auth/
├── server.ts
├── client.ts
├── session.ts
├── config.ts
├── providers.ts
└── authenticated-player.ts

src/components/auth/
├── command-auth-modal.tsx
├── command-auth-controller.tsx
├── auth-provider-buttons.tsx
├── auth-credentials-form.tsx
└── auth-register-form.tsx
```

MUST:

- Client Components não importarem `server.ts`, DB pool ou secret config;
- `server.ts` usar `server-only` ou equivalente;
- `client.ts` não ler env auth;
- provider setup e private keys ficarem em módulos server-only.

## 17. Origem, CSRF e redirects

MUST:

- configurar `BETTER_AUTH_URL` explicitamente em produção ou estratégia multi-host fechada;
- rejeitar origins não confiáveis;
- validar callback/returnTo contra allowlist interna;
- não confiar em Host/X-Forwarded arbitrário;
- manter `trustedProxyHeaders` desligado sem contrato infra;
- manter cross-subdomain cookies desligados inicialmente;
- não incluir localhost nas origins de produção;
- permitir `appleid.apple.com` somente como exceção explícita necessária ao provider Apple.

## 18. Rate limiting, logs e email

Login, cadastro, reset e verification MUST possuir rate limiting.

Logs MUST redigir:

- Cookie/Authorization;
- senha/hash;
- session token;
- OAuth code/access/refresh/ID token;
- Apple private key/client-secret JWT;
- DB URL;
- provider secrets;
- reset/verification tokens.

Email provider ainda pode ser escolhido depois, mas API key/SMTP é server-only e placeholder `.invalid` MUST ser rejeitado por qualquer envio.

## 19. Logout e realtime

Logout MUST invalidar sessão auth e remover seu cookie, sem depender de estado React antigo.

O gateway realtime SHOULD continuar sem conhecer Better Auth diretamente:

```text
browser cookies
   ↓
Next.js valida auth user + player seat
   ↓
emite ticket realtime curto
   ↓
gateway valida ticket
```

Steam/Xbox/Epic identities futuras não substituem esse ticket automaticamente.

## 20. Arquivos de ambiente

MUST:

- ignorar `.env`, `.env.local`, `.env.production*` reais;
- versionar `.env.example` apenas com placeholders;
- não incluir secrets reais em docs/tests/workflows/snapshots;
- usar secret store de CI/deploy;
- não armazenar Apple `.p8` no repositório.

Exemplo conceitual:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB
BETTER_AUTH_SECRET=replace-with-high-entropy-secret
BETTER_AUTH_URL=https://example.com
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
APPLE_CLIENT_ID=replace-me
APPLE_TEAM_ID=replace-me
APPLE_KEY_ID=replace-me
APPLE_PRIVATE_KEY=replace-with-p8-private-key
DISCORD_CLIENT_ID=replace-me
DISCORD_CLIENT_SECRET=replace-me
AUTH_EMAIL_FROM=War Brasil <no-reply@example.com>
```

Nenhuma dessas variáveis usa `NEXT_PUBLIC_`.

## 21. Não fazer

MUST NOT:

- manter GitHub no launch por herança do Contrapista;
- adicionar provider apenas porque Better Auth oferece suporte;
- usar email como cross-provider identity key;
- fazer implicit linking por email no launch;
- usar username Discord/Google/Apple como handle permanente sem confirmação;
- encaixar Steam OpenID 2.0 artificialmente no Generic OAuth;
- confundir login Microsoft com integração Xbox/XUID;
- confiar em cookie de assento como conta;
- ler cookie HttpOnly via JS;
- colocar segredo em `NEXT_PUBLIC_*`;
- persistir tokens em storage client;
- proteger endpoint apenas escondendo UI;
- habilitar trusted provider/trusted proxy/cross-domain cookie por conveniência;
- retornar password hash/provider tokens na sessão.

## 22. Definition of Done

O usuário consegue clicar em `ENTRAR NO COMANDO`, reutilizar sessão válida ou autenticar-se por Google, Apple, Discord ou credentials, concluir onboarding público quando necessário e acessar áreas protegidas. Providers adicionais permanecem fora até justificativa explícita. Account linking é explícito, secrets permanecem server-only, nenhum auth-specific `NEXT_PUBLIC_*` existe e todos os gates de `EVAL.md` passam.
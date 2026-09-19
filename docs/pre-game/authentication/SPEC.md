# SPEC — Authentication / Command Access

**ID:** PRE-AUTH  
**Escopo:** identidade de conta, restauração de sessão, login/cadastro, três métodos de autenticação, verificação de email, gate de acesso ao comando, proteção server-side e fronteira de segredos.  
**Integração inicial:** Home (`ENTRAR NO COMANDO`) → onboarding → matchmaking/lobby/profile/game.  
**Target técnico inicial:** Better Auth 1.7.x fixado em versão validada pelo CI; PostgreSQL continua sendo a fonte persistente.  
**Provider strategy:** `PROVIDER-STRATEGY.md`.  
**Modelo de dados:** `DATABASE-PLAN.md`.

Este documento segue `../quality-standard.md`. Autenticação é estado de negócio e MUST permanecer independente da timeline/renderer da Foundation.

## 1. Objetivo

Ao clicar em `ENTRAR NO COMANDO`, a aplicação MUST reutilizar uma sessão válida já persistida pelo navegador. Se a sessão não existir, estiver expirada/revogada ou for inválida, a Home abre o modal de autenticação.

Após autenticação válida, o sistema verifica se `profile.commanders` está completo. Conta autenticada sem `handle`/`display_name` segue para onboarding antes de abrir o Comando.

Fluxo normativo:

```text
ENTRAR NO COMANDO
        ↓
consultar/revalidar sessão
   ┌────┴───────────────┐
 inválida             válida
   ↓                    ↓
AUTH MODAL        perfil completo?
                      ┌─┴─┐
                    não   sim
                     ↓     ↓
                 ONBOARD  COMANDO
                     ↓
                  COMANDO
```

A checagem da Home é UX. Segurança MUST ser aplicada novamente no servidor em cada recurso protegido.

## 2. Métodos de autenticação do launch

A primeira versão possui **exatamente três** métodos:

1. Google;
2. Discord;
3. email + senha.

MUST NOT implementar, configurar ou exibir qualquer quarto método nesta trilha.

Em particular, Apple, GitHub, Microsoft, Steam, Twitch, Epic e passkeys estão fora deste escopo atual.

Adicionar novo método exige atualização explícita de `PROVIDER-STRATEGY.md`, `SPEC.md` e `EVAL.md` antes do código.

## 3. Better Auth e ownership

A implementação SHOULD usar Better Auth em vez de autenticação própria.

MUST:

- manter a instância Better Auth em módulo `server-only`;
- montar handlers sob `/api/auth/*`;
- usar PostgreSQL para user/session/account/verification;
- manter migrations sob a infraestrutura versionada do War-Brasil;
- não criar/alterar schema no request path;
- fixar versão exata do Better Auth na primeira implementação;
- revisar changelog/schema antes de upgrade;
- preferir primitives oficiais Better Auth para token, verification, password hashing, OAuth e sessão;
- não manter uma segunda fonte de verdade para verification tokens ou provider accounts.

## 4. Conta x assento de jogo

`war_brasil_player` continua sendo identidade de assento/sessão de jogo, não conta.

```text
Conta persistente                         Assento/sessão de jogo
Better Auth session                       war_brasil_player
        ↓                                        ↓
auth.user.id                              game.players.player_session
        └──────────────→ game.players.user_id ←─┘
```

Regras:

- possuir somente `war_brasil_player` MUST NOT autenticar uma conta;
- possuir somente uma conta MUST NOT autorizar um seat específico;
- comandos protegidos evoluem para validar conta + seat;
- bots podem continuar com `game.players.user_id = NULL`;
- consultar `DATABASE-PLAN.md` para constraints, snapshots e histórico.

## 5. Sessão

Sessão de conta MUST usar cookie seguro gerenciado pelo Better Auth.

MUST:

- `HttpOnly`;
- `Secure` em produção;
- `SameSite=Lax` ou política mais restritiva compatível com os callbacks escolhidos;
- host-only por padrão;
- `Path=/`;
- nunca persistir token de sessão em `localStorage`, `sessionStorage` ou IndexedDB;
- suportar revogação/logout server-side;
- tratar sessão ausente, expirada ou revogada como `unauthenticated`;
- nunca inferir autenticação pela simples presença de cookie sem validar a sessão em recurso sensível.

Duração/cache de sessão são constantes versionadas em código, não toggles arbitrários de env.

## 6. Home / `ENTRAR NO COMANDO`

A Home MAY prefetchar estado de sessão durante a Genesis para reduzir latência percebida.

State machine de acesso:

```text
idle
 ↓ click
checking-session
 ├── unauthenticated -> auth-modal
 ├── authenticated + profile-incomplete -> onboarding
 ├── authenticated + profile-complete -> command-open
 └── recoverable-error -> auth-modal/error sem quebrar Home
```

MUST:

- assentar a cerimônia visual independentemente da rede/auth;
- não ler cookie HttpOnly via JavaScript;
- não abrir command-open antes de sessão válida;
- não depender de WebGL/reduced-motion para login;
- restaurar foco corretamente ao fechar modal;
- após OAuth/login credentials, continuar o fluxo sem reload completo quando possível.

## 7. Modal de autenticação

O modal reutiliza a estrutura de interação do Contrapista, redesenhada para a linguagem War-Brasil.

A UI principal oferece somente:

- `Continuar com Google`;
- `Continuar com Discord`;
- formulário Email + Senha;
- alternância `Entrar` / `Criar conta`;
- recuperação de senha;
- estado de verificação de email pendente para credentials.

MUST possuir:

- pending state por ação;
- prevenção de double-submit;
- erros de validação por campo quando seguros;
- mensagens gerais não-enumeráveis;
- focus trap;
- `role="dialog"`/`aria-modal="true"` ou primitive equivalente;
- Escape/backdrop controlado;
- foco inicial previsível;
- restauração de foco;
- body scroll lock;
- mobile sem overflow horizontal;
- navegação completa por teclado.

## 8. Google

Google MUST:

- usar provider oficial/built-in suportado pela versão fixada do Better Auth;
- solicitar somente identidade básica (`openid`, `email`, `profile` ou defaults mínimos equivalentes);
- usar provider subject/account ID como identidade externa estável;
- manter `GOOGLE_CLIENT_SECRET` server-only;
- não solicitar Drive/Calendar/Contacts no login;
- não converter email Google em handle público.

Nome/avatar Google MAY preencher sugestões/fallbacks de onboarding apenas.

## 9. Provider removido: Apple

Apple não faz parte do launch atual.

MUST NOT existir nesta implementação:

- provider Apple configurado no Better Auth;
- botão `Continuar com Apple`;
- variáveis `APPLE_*` ativas;
- geração de client secret/JWT Apple;
- callback Apple como fluxo suportado;
- teste positivo de login Apple.

Adicionar Apple futuramente é mudança de escopo e exige atualização prévia de SPEC/EVAL/Provider Strategy.

## 10. Discord

Discord MUST:

- solicitar somente `identify` + `email` quando necessário;
- usar Discord user ID como identidade externa;
- não tratar username/global name como identificador estável;
- não solicitar `guilds`, bot, connections, activities ou outros scopes sem novo SPEC;
- manter `DISCORD_CLIENT_SECRET` server-only.

### 10.1 Discord sem email

Contas Discord podem não fornecer email.

Se a versão Better Auth fixada exigir email:

- fallback sintético MUST ser derivado do provider ID;
- MUST usar domínio `.invalid`;
- MUST ser marcado/tratado como não-entregável;
- MUST NOT receber verification/reset/comunicação;
- MUST NOT aparecer na PROFILE;
- MUST NOT participar de linking implícito.

Preferir mecanismo oficial da versão pinada do Better Auth para provider sem email quando disponível.

## 11. Account linking

A conta War-Brasil é a entidade principal; providers são credenciais vinculadas.

Política inicial:

```text
accountLinking.enabled = true
accountLinking.disableImplicitLinking = true
accountLinking.allowDifferentEmails = true
accountLinking.trustedProviders = []
accountLinking.updateUserInfoOnLink = false
accountLinking.allowUnlinkingAll = false
```

MUST:

- nunca fazer merge silencioso só porque emails coincidem;
- permitir linking explícito a partir de sessão autenticada;
- não permitir provider vinculado sobrescrever `profile.commanders`;
- impedir que o usuário remova o último método de acesso sem fluxo de recuperação aprovado.

## 12. Email + senha — cadastro confirmado por OTP

Uma tentativa de cadastro credentials **não é uma conta** até que o usuário prove posse do email.

### 12.1 Fluxo normativo

```text
CRIAR CONTA
   ↓
email + senha + aceite legal
   ↓
auth.pending_registration
   ↓
OTP de 6 dígitos por email
   ↓
SEM auth.user / SEM sessão
   ↓
usuário confirma OTP
   ↓
transação cria auth.user(emailVerified=true)
           + auth.account(credential)
   ↓
pending_registration é removido
   ↓
sessão Better Auth
   ↓
perfil completo?
 ├─ não -> onboarding
 └─ sim -> command-open
```

### 12.2 Better Auth

Credentials MUST manter:

```ts
emailAndPassword: {
  enabled: true,
  disableSignUp: true,
  requireEmailVerification: true,
  autoSignIn: false,
}
```

O signup nativo fica desabilitado para impedir qualquer criação de `auth.user` antes do OTP.

O hash permanente da senha continua compatível com o Better Auth e permanece em `auth.account`.

### 12.3 Pending registration

War-Brasil MUST possuir `auth.pending_registration` como storage efêmero pré-conta.

MUST armazenar:

- email normalizado;
- password **ciphertext** autenticado, nunca plaintext;
- HMAC do OTP, nunca OTP bruto;
- contador de tentativas;
- aceite legal;
- expiração;
- cooldown de reenvio.

MUST NOT criar antes da confirmação:

- `auth.user`;
- `auth.account`;
- sessão;
- `profile.commanders`;
- wallet/loadout/economy.

### 12.4 OTP

Contrato:

- 6 dígitos;
- validade de 10 minutos;
- máximo de 5 tentativas;
- cooldown de reenvio de 60 segundos;
- novo envio invalida o código anterior;
- replay após promoção falha porque a linha pendente já foi removida.

## 13. Estado `verification-pending`

Depois do cadastro credentials aceito:

- senha deixa o estado visível da UI;
- modal solicita OTP;
- email é mascarado;
- input usa `autocomplete="one-time-code"`;
- UI informa validade de 10 minutos;
- UI oferece `REENVIAR CÓDIGO`;
- não existe sessão nem conta permanente antes da confirmação.

Texto base:

```text
CONFIRME SEU EMAIL
Enviamos um código de 6 dígitos.
Digite o código para concluir a criação da sua conta.
```

## 14. Reenvio

Reenvio usa `POST /api/auth/register/resend` e o mesmo registro temporário.

MUST:

- rate-limit/cooldown server-side;
- gerar novo OTP;
- invalidar o anterior;
- zerar contador de tentativas;
- devolver resposta não-enumerável;
- não enviar para `.invalid`;
- não logar OTP.

Resposta pública:

```text
Se existir um cadastro pendente para esse endereço, enviaremos um novo código.
```

## 15. Confirmação e sessão

`POST /api/auth/register/verify` MUST promover o cadastro dentro de uma transação PostgreSQL.

Para OTP válido:

- criar `auth.user` já com `emailVerified=true`;
- criar `auth.account` com `providerId='credential'`;
- remover `auth.pending_registration`;
- só então criar sessão através do Better Auth;
- seguir diretamente para onboarding quando `profile.commanders` estiver incompleto.

OTP inválido/expirado MUST NOT criar `auth.user`.

## 16. Email de confirmação

O email de cadastro chama a boundary server-only `sendAuthEmail()`.

MUST:

- conter OTP de 6 dígitos;
- informar validade de 10 minutos;
- possuir HTML + texto simples;
- usar transportador/credencial server-only;
- não conter senha/hash/ciphertext;
- não conter link/token de confirmação;
- não aguardar entrega de forma que introduza side-channel evitável.

O password reset continua separado e usa primitives/tokens Better Auth.

## 17. Recuperação de senha

Email + senha MUST possuir password reset real antes de ser considerado completo.

MUST:

- usar primitive Better Auth;
- token expirável e uso único conforme suporte da biblioteca;
- resposta não-enumerável;
- credential do email provider server-only;
- nunca logar reset token;
- revogar sessões existentes após mudança de senha se a política final assim definir no código versionado.

## 18. Email/social provider verification

A exigência de seção 12 é especificamente obrigatória para credentials.

Para Google/Discord:

- usar provider account ID como prova de identidade externa;
- considerar `email_verified` do provider somente quando confiável/documentado;
- não bloquear Discord válido apenas porque ele não fornece email;
- não enviar verification credentials para `.invalid`;
- não transformar OAuth em email/password por conveniência.

## 19. Perfil / onboarding

Sessão válida não implica perfil público completo.

Antes de command-open:

```text
authenticated
    ↓
profile.commanders exists + handle/display_name completos?
  ├─ não -> onboarding
  └─ sim -> command-open
```

Google/Discord name/avatar MAY preencher sugestões. Credentials pode usar parte local do formulário apenas como sugestão visual, nunca gerar handle definitivo silenciosamente.

Handle é escolhido/confirmado pelo usuário e validado contra `profile.commanders`.

## 20. Rotas protegidas

Inicialmente:

- `/` — público;
- `/rules` — autenticado;
- `/matchmaking` — autenticado + perfil completo;
- `/profile` — autenticado; onboarding pode usar subrota/estado próprio;
- lobby/game — autenticados + autorização de seat;
- APIs mutáveis — validação server-side obrigatória.

A Home é a única página pública de produto. Proxy MAY melhorar UX, mas presença de cookie não substitui `auth.api.getSession()`/primitive equivalente em operação sensível.

## 21. Fronteira de ambiente e segredos

### 21.1 Regra principal

A allowlist inicial de env pública específica de auth é **vazia**.

Nenhuma variável auth recebe `NEXT_PUBLIC_` sem mudança de SPEC + EVAL.

### 21.2 Server-only

```text
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_SECRETS            # somente se rotação for adotada
BETTER_AUTH_URL

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET

AUTH_ALLOWED_HOSTS             # se estratégia multi-host exigir
AUTH_EMAIL_FROM
<EMAIL_TRANSPORT_SECRET>
SMTP_URL                        # somente se SMTP for o transport escolhido
```

IDs não são necessariamente segredos criptográficos, mas continuam server-only porque o client Better Auth não precisa deles.

### 21.3 Não criar nesta fase

MUST NOT introduzir env para providers fora dos três métodos:

```text
APPLE_*
GITHUB_*
MICROSOFT_*
STEAM_*
TWITCH_*
EPIC_*
PASSKEY_*
```

### 21.4 Nunca pode cruzar server -> browser

- `DATABASE_URL`;
- `BETTER_AUTH_SECRET(S)`;
- OAuth client secrets;
- email transport credential;
- senha/password hash;
- session token bruto fora do cookie HttpOnly;
- verification/reset token fora do fluxo necessário;
- OAuth access/refresh/ID token;
- realtime signing secrets;
- stack/SQL/connection error com credenciais.

## 22. Dados permitidos no client

O client recebe somente o mínimo da sessão/UX, por exemplo:

```ts
type ClientAuthUser = {
  id: string;
  displayName: string | null;
  image: string | null;
  profileComplete: boolean;
};
```

Email MAY ser enviado apenas para superfícies autenticadas que realmente o necessitem (configurações de conta/verificação), não como dado padrão da PROFILE pública.

User ID não é segredo, mas não é prova de autorização.

## 23. Import boundaries

Estrutura alvo:

```text
src/lib/auth/
├── server.ts
├── client.ts
├── config.ts
├── session.ts
├── email.ts
└── authenticated-player.ts

src/components/auth/
├── command-auth-modal.tsx
├── auth-provider-buttons.tsx
├── auth-credentials-form.tsx
├── auth-verification-pending.tsx
└── auth-onboarding.tsx
```

MUST:

- `server.ts`, `config.ts` e `email.ts` serem server-only quando lidarem com secrets;
- módulo `"use client"` não importar DB/auth server/env secreto;
- client auth não ler `process.env` específico de auth;
- UI chamar somente client SDK/rotas permitidas.

## 24. Origem, CSRF e redirects

MUST:

- `BETTER_AUTH_URL` explícita em produção;
- trusted origins fechadas;
- callback URLs por provider validadas;
- verification callback interno/allowlisted;
- `returnTo` externo arbitrário rejeitado;
- `trustedProxyHeaders` desligado salvo contrato de infraestrutura;
- cross-subdomain cookie desligado inicialmente;
- localhost fora de trusted origins de produção.

## 25. Rate limiting

MUST aplicar rate limit em:

- login credentials;
- cadastro credentials;
- resend verification;
- password reset;
- verification/resend abusivo conforme primitives suportadas.

Resposta excessiva usa `429` recuperável sem revelar existência da conta.

## 26. Logging

MUST redigir:

- `Cookie`/`Authorization`;
- password/hash;
- session token;
- OAuth code/access/refresh/ID token;
- verification/reset token e URLs que os contenham;
- DB URL/password;
- provider secrets;
- email transport secrets.

Eventos podem registrar IDs opacos, provider, tipo do evento, timestamp, resultado e debug ID.

## 27. Arquivos de ambiente

MUST:

- ignorar `.env*` reais conforme política do repo;
- versionar somente `.env.example` com placeholders;
- manter secrets no secret store de deploy;
- nunca colocar credencial real em docs/tests/snapshots/workflows;
- CI usar valores-sentinela falsos para leak scan.

## 28. Não fazer

MUST NOT:

- adicionar provider além dos três aprovados;
- adicionar Apple sem novo SPEC/EVAL;
- manter GitHub por herança do Contrapista;
- criar auth custom do zero;
- copiar `email_verification_tokens` do Contrapista;
- criar sessão credentials antes da confirmação;
- criar `auth.user` ou sessão antes de um OTP válido;
- guardar password hash em tabela War-Brasil paralela;
- usar email como handle/autoridade/linking implícito;
- ler cookie HttpOnly via JS;
- expor segredo via `NEXT_PUBLIC_*`;
- persistir token em local/session storage;
- proteger API só escondendo botão;
- logar OTP, password ciphertext ou qualquer credencial temporária;
- confiar em callback externo arbitrário.

## 29. Definition of Done

O usuário pode entrar com Google, Discord ou email+senha. Credentials permanece em `auth.pending_registration` até a confirmação de um OTP de 6 dígitos; somente então `auth.user`/`auth.account` são criados, a sessão Better Auth é estabelecida e o onboarding de comandante é aberto. OAuth converge para o mesmo onboarding. Segredos permanecem server-only e todos os gates de `EVAL.md` devem passar.

# SPEC — Authentication / Command Access

**ID:** PRE-AUTH  
**Escopo:** identidade de conta, restauração de sessão, login/cadastro, gate de acesso ao comando, proteção server-side e fronteira de segredos.  
**Integração inicial:** Home (`ENTRAR NO COMANDO`) → matchmaking/lobby/profile/game.  
**Target técnico inicial:** Better Auth 1.7.x, inicialmente fixado em versão validada pelo CI; PostgreSQL continua sendo a fonte persistente.

Este documento segue `../quality-standard.md`. Autenticação é estado de negócio e MUST permanecer independente da timeline/renderer da Foundation.

## 1. Objetivo

Ao clicar em `ENTRAR NO COMANDO`, a aplicação MUST reutilizar uma sessão de autenticação válida já persistida pelo navegador. Se a sessão não existir, estiver expirada, revogada ou for inválida, a Home MUST abrir um modal de autenticação sem desmontar a cena.

Fluxo normativo:

```text
ENTRAR NO COMANDO
        ↓
revalidar/consultar sessão
   ┌────┴─────┐
 válida      ausente/inválida
   ↓             ↓
COMANDO        AUTH MODAL
ABERTO            ↓
             login/cadastro
                  ↓
            sessão válida
                  ↓
             COMANDO ABERTO
```

A checagem da Home é UX. Segurança MUST ser aplicada novamente no servidor em cada recurso protegido.

## 2. Decisões arquiteturais

### 2.1 Biblioteca de autenticação

A implementação SHOULD usar Better Auth em vez de autenticação própria.

MUST:

- manter a instância server-side de auth em módulo `server-only` ou equivalente;
- montar handlers sob `/api/auth/*`;
- usar PostgreSQL para usuários/sessões/contas/verificações;
- manter migrations sob a infraestrutura de migrations do War-Brasil;
- não executar criação/alteração de schema de autenticação implicitamente em cada request de produção;
- fixar explicitamente a versão do pacote durante a primeira implementação e revisar changelog/migrations antes de upgrades.

A CLI do Better Auth MAY gerar SQL como entrada para revisão, mas a migration aplicada ao projeto MUST permanecer versionada, auditável e testável pelo fluxo já existente de banco.

### 2.2 Duas identidades distintas

O War-Brasil já possui `war_brasil_player`, usado para identificar a sessão/assento do jogador dentro de salas. Esse cookie não é identidade de conta.

O modelo alvo MUST distinguir:

```text
Conta persistente                         Assento/sessão de jogo
Better Auth session                       war_brasil_player
        ↓                                        ↓
auth.user.id                              game.players.player_session
        └──────────────→ game.players.user_id ←─┘
```

Regras:

- `auth user` identifica a pessoa/conta;
- `player_session` identifica o assento/instância de jogo;
- possuir somente `war_brasil_player` MUST NOT autenticar uma conta;
- possuir somente uma sessão de conta MUST NOT autorizar um assento específico de uma sala;
- comandos de jogo protegidos SHOULD evoluir para validar simultaneamente conta + assento.

## 3. Banco de dados

A autenticação SHOULD usar schema PostgreSQL dedicado `auth`.

Modelos mínimos esperados:

```text
auth
├── user
├── session
├── account
├── verification
└── rate_limit   (se rate limiting persistido for adotado)
```

IDs de usuário SHOULD ser UUID nativo no PostgreSQL.

`game.players` deverá receber, em migration própria:

```sql
user_id UUID NULL REFERENCES auth.user(id)
```

Regras:

- `user_id` inicialmente MAY ser nullable para bots e compatibilidade de rollout;
- um jogador autenticado novo MUST persistir `user_id`;
- SHOULD existir unicidade parcial `(room_id, user_id)` quando `user_id IS NOT NULL` para impedir a mesma conta em dois assentos da mesma sala;
- bots MUST permanecer com `user_id = NULL`;
- migrations MUST ser idempotentes dentro do padrão do projeto e possuir upgrade + clean-install tests.

## 4. Sessão

Sessão de conta MUST ser baseada em cookie seguro gerenciado pela biblioteca de autenticação. O navegador não deve receber token de sessão para manipulação manual.

MUST:

- cookie `HttpOnly`;
- `Secure` em produção;
- `SameSite=Lax` ou política mais restritiva compatível com OAuth;
- host-only por padrão;
- `Path=/`;
- não persistir token de sessão em `localStorage`, `sessionStorage`, IndexedDB ou estado serializado da página;
- aceitar logout/revogação server-side;
- tratar sessão ausente/expirada/revogada como não autenticada.

A duração da sessão e a janela de cache MUST ser constantes versionadas em código, não toggles ocultos de ambiente, salvo necessidade operacional documentada posteriormente.

## 5. Fluxo da Home

A Home MAY iniciar leitura leve de sessão enquanto a Genesis roda para reduzir latência percebida.

`ENTRAR NO COMANDO` MUST obedecer:

```text
idle
 ↓ click
checking-session
 ├── authenticated   → command-open
 ├── unauthenticated → auth-modal
 └── recoverable error → auth-modal/error state sem quebrar Home
```

MUST:

- encerrar/assentar a cerimônia visual sem esperar autenticação;
- não bloquear a UI por mais tempo que a consulta de sessão;
- não ler cookies HttpOnly via JavaScript;
- não inferir autenticação apenas pela existência de `war_brasil_player`;
- não abrir `command-open` até existir sessão autenticada válida;
- após login bem-sucedido, fechar o modal e continuar o fluxo sem reload completo quando tecnicamente possível;
- preservar funcionamento com reduced-motion e fallback WebGL.

## 6. Modal de autenticação

O modal SHOULD reutilizar a estrutura de interação do Contrapista, redesenhada para a linguagem visual do War-Brasil.

Métodos iniciais:

- email + senha;
- Google;
- GitHub;
- alternância login/cadastro;
- recuperação de senha;
- verificação de email para contas por credenciais.

MUST possuir:

- estado pending explícito;
- erro genérico de credenciais inválidas sem revelar se um email existe;
- erros de validação por campo onde não houver risco de enumeração;
- Escape/backdrop controlado;
- focus trap;
- `role="dialog"`/`aria-modal="true"` ou primitive equivalente;
- foco inicial previsível;
- restauração de foco ao fechar;
- prevenção de overflow do body;
- layout mobile sem scroll horizontal;
- navegação completa por teclado.

## 7. Cadastro e credenciais

Para email/senha:

- email MUST ser normalizado no servidor;
- senha MUST ser processada somente por primitive de password hashing suportada pela solução de auth;
- senha em texto puro MUST existir somente durante o request necessário ao cadastro/login e nunca ser persistida/logada;
- email verification SHOULD ser obrigatória antes de liberar acesso completo de conta;
- password reset MUST usar token de uso único/expirável gerado e validado no servidor;
- respostas de reset/verification MUST evitar enumeração de contas.

O cliente MAY exibir requisitos de senha, mas a validação autoritativa MUST existir no servidor.

## 8. OAuth

Providers iniciais: Google e GitHub.

MUST:

- usar authorization-code/OIDC flow suportado pela biblioteca;
- validar `state`/nonce quando aplicável;
- usar callback URL originada da configuração server-side de auth;
- manter `clientSecret` somente no servidor;
- solicitar somente scopes necessários à identidade básica;
- não enviar access token, refresh token ou ID token ao estado global da UI;
- não salvar provider tokens em `localStorage`/`sessionStorage`;
- restringir account linking às regras seguras da biblioteca;
- não habilitar trusted providers/account linking permissivo sem revisão de segurança.

## 9. Rotas protegidas

A Home não é a fronteira de autorização.

Inicialmente:

- `/` — público;
- `/rules` — público;
- `/matchmaking` — autenticado;
- `/profile` — autenticado;
- lobby e jogo — autenticados;
- APIs mutáveis de sala/jogo — autenticação server-side obrigatória após a fase de integração.

Proxy/middleware MAY ser usado para UX/redirecionamento. Operações sensíveis MUST validar sessão no servidor via API oficial da solução de auth.

MUST NOT considerar uma checagem de presença de cookie como autorização suficiente.

## 10. Fronteira de ambiente e segredos

### 10.1 Regra principal

**O auth client não precisa de nenhum segredo nem de nenhuma variável `NEXT_PUBLIC_*` específica de autenticação.**

A allowlist inicial de variáveis públicas de auth é vazia.

Nenhuma variável nova de autenticação pode receber prefixo `NEXT_PUBLIC_` sem alteração explícita deste SPEC + EVAL.

### 10.2 Variáveis server-only normativas

| Variável | Classe | Produção | Pode ir ao browser? | Uso |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | segredo | MUST | **NUNCA** | conexão PostgreSQL; já existe no projeto |
| `BETTER_AUTH_SECRET` | segredo crítico | MUST no bootstrap inicial | **NUNCA** | assinatura/encriptação/hashing da auth |
| `BETTER_AUTH_SECRETS` | segredo crítico/versionado | MAY substituir/complementar estratégia de rotação | **NUNCA** | rotação de chaves sem invalidar dados |
| `BETTER_AUTH_URL` | configuração server-only, não segredo | MUST em produção single-origin | **NÃO** | origem canônica de callback/auth |
| `GOOGLE_CLIENT_ID` | identificador OAuth | MUST se Google habilitado | **NÃO por padrão** | configuração server-side do provider |
| `GOOGLE_CLIENT_SECRET` | segredo crítico | MUST se Google habilitado | **NUNCA** | OAuth Google |
| `GITHUB_CLIENT_ID` | identificador OAuth | MUST se GitHub habilitado | **NÃO por padrão** | configuração server-side do provider |
| `GITHUB_CLIENT_SECRET` | segredo crítico | MUST se GitHub habilitado | **NUNCA** | OAuth GitHub |
| `AUTH_ALLOWED_HOSTS` | configuração server-only | MAY em multi-host/preview | **NÃO** | allowlist explícita de hosts quando necessária |
| `AUTH_EMAIL_FROM` | configuração server-only | MUST quando email transacional habilitado | **NÃO** | remetente de verificação/reset |
| `<EMAIL_PROVIDER>_API_KEY` / `SMTP_URL` | segredo crítico | MUST conforme provider escolhido | **NUNCA** | envio de email transacional |

`BETTER_AUTH_SECRET` MUST possuir pelo menos 32 caracteres de alta entropia. Segredos MUST ser gerados fora do repositório e armazenados no secret store do ambiente de deploy.

### 10.3 O que NÃO deve virar variável de ambiente inicialmente

Os itens abaixo SHOULD permanecer versionados em código/config validada, não em env, para evitar divergência silenciosa entre ambientes:

- duração nominal da sessão;
- janela de renovação/cache da sessão;
- nomes de cookies;
- cookie prefix;
- `SameSite` policy;
- `HttpOnly` policy;
- lista de rotas protegidas;
- limites de senha/validação;
- limites normais de rate limit;
- habilitação de `trustedProxyHeaders`;
- habilitação de cross-subdomain cookies;
- scopes OAuth;
- regras de account linking;
- nomes das tabelas/schema;
- permissões retornadas na sessão.

Mudanças nesses valores são mudanças de comportamento/segurança e MUST passar por código, review e CI.

### 10.4 Variáveis públicas existentes

Variáveis públicas não relacionadas, como `NEXT_PUBLIC_GAME_*`, MAY continuar existindo para funcionalidades explicitamente client-side.

Autenticação MUST NOT reutilizar `NEXT_PUBLIC_SITE_URL` como fonte autoritativa de callbacks se `BETTER_AUTH_URL` estiver configurada. `SITE_URL`/metadata e `BETTER_AUTH_URL` SHOULD apontar para a mesma origem canônica em produção, mas auth usa sua configuração server-side.

### 10.5 Segredos que nunca podem cruzar a fronteira server → browser

É BLOCKER se qualquer um destes valores aparecer em bundle JS, HTML serializado, RSC payload, JSON de API cliente, logs de console do browser, source map público ou storage do navegador:

- `DATABASE_URL` ou credenciais derivadas do banco;
- `BETTER_AUTH_SECRET` / valores de `BETTER_AUTH_SECRETS`;
- OAuth client secrets;
- API keys/SMTP credentials;
- senha em texto puro após o request;
- password hash;
- session token bruto quando não estritamente necessário ao cookie HttpOnly;
- verification token bruto fora do canal de verificação necessário;
- reset-password token fora do fluxo necessário;
- OAuth access token;
- OAuth refresh token;
- OAuth client secret;
- provider ID token;
- realtime signing secrets (`GAME_REALTIME_TICKET_SECRET` etc.);
- automation worker secrets/tokens;
- stack traces/SQL/connection errors contendo credenciais.

### 10.6 Dados permitidos no cliente

Após autenticação, o browser MAY receber somente o mínimo necessário à UX, por exemplo:

```ts
type ClientAuthUser = {
  id: string;
  displayName: string | null;
  image: string | null;
  email?: string; // somente onde necessário à UI autenticada
};
```

O ID de usuário não é tratado como segredo e MUST NOT ser usado como prova de autorização.

Email SHOULD ser omitido de superfícies que não precisam exibi-lo e MUST NOT ser enviado para analytics/logs client-side por padrão.

Provider tokens, hashes e credenciais nunca fazem parte de `ClientAuthUser`.

## 11. Módulos e import boundaries

Estrutura alvo sugerida:

```text
src/lib/auth/
├── server.ts          // server-only: Better Auth instance + secrets
├── client.ts          // createAuthClient; zero process.env secreto
├── session.ts         // helpers server-side
├── config.ts          // leitura/validação de env server-side
└── authenticated-player.ts

src/components/auth/
├── command-auth-modal.tsx
├── command-auth-controller.tsx
├── auth-provider-buttons.tsx
├── auth-credentials-form.tsx
└── auth-register-form.tsx

src/app/api/auth/[...all]/route.ts
```

MUST:

- módulos com `"use client"` não importarem `server.ts`, pool de DB nem config secreta;
- `server.ts` usar `import "server-only"` ou barreira equivalente;
- `client.ts` não ler `process.env` de autenticação;
- Client Components chamarem somente API/client SDK permitido.

## 12. Origem, CSRF e redirects

MUST:

- configurar `BETTER_AUTH_URL` explicitamente em produção ou usar estratégia multi-host com allowlist explícita;
- usar trusted origins/allowed hosts fechados;
- não confiar em `Host`/`X-Forwarded-*` arbitrário;
- manter `trustedProxyHeaders` desabilitado salvo infraestrutura conhecida e documentada;
- rejeitar origins não confiáveis;
- validar `returnTo`/callback URLs contra allowlist interna para impedir open redirect;
- não incluir localhost em trusted origins de produção.

Cross-subdomain cookies SHOULD permanecer desabilitados inicialmente.

## 13. Rate limiting e abuso

Login, cadastro, reset e verificação MUST possuir rate limiting.

Produção multi-instância SHOULD usar storage persistente/compartilhado para contadores se a implementação exigir consistência entre instâncias.

MUST:

- resposta `429` recuperável;
- não revelar se email existe;
- não confiar em header de IP controlável pelo cliente sem proxy confiável;
- não registrar senha/token nos logs de rate-limit/audit.

## 14. Email transacional

Provider ainda pode ser escolhido em fase posterior, mas o contrato é fixo:

- API key/SMTP URL = server-only secret;
- remetente = server-only config;
- templates MAY ser versionados no repositório;
- token/URL de verificação/reset só deve existir no servidor + mensagem enviada ao usuário;
- envio SHOULD evitar diferença temporal observável que facilite enumeração de conta;
- falha de envio não pode vazar stack/provider credentials ao cliente.

## 15. Logging e observabilidade

MUST redigir:

- Authorization/Cookie headers;
- session token;
- OAuth code/token;
- senha/hash;
- verification/reset token;
- DB URL/password;
- provider secrets.

Eventos de segurança MAY registrar IDs opacos, tipo do evento, timestamp, resultado e debug ID.

Mensagem ao usuário MUST ser curta e não conter SQL, stack ou detalhes de provider.

## 16. Logout

Logout MUST:

- invalidar/remover sessão de conta;
- remover cookie de auth conforme biblioteca;
- fazer recursos protegidos falharem imediatamente após a revogação aplicável;
- não apagar automaticamente `war_brasil_player` na primeira fase, pois é identidade distinta de assento/compatibilidade;
- não deixar Profile/Matchmaking acessíveis apenas porque a UI ainda possui estado local antigo.

## 17. Realtime

O gateway realtime SHOULD continuar sem conhecer Better Auth diretamente.

Fluxo alvo:

```text
browser cookies
   ↓
Next.js valida auth user + player seat
   ↓
emite ticket realtime curto
   ↓
gateway valida ticket
```

O ticket pode conter IDs/claims mínimos, mas o segredo que o assina MUST permanecer server-only.

## 18. Arquivos de ambiente e repositório

MUST:

- `.env`, `.env.local`, `.env.production*` reais ignorados pelo Git;
- `.env.example` MAY ser versionado somente com nomes e valores placeholder;
- nenhum segredo real em README, docs, tests, fixtures, snapshots ou workflow committed;
- CI SHOULD usar secrets/sentinels próprios e nunca imprimir valores reais;
- preview/produção MUST receber segredos pelo secret store da plataforma.

Exemplo permitido:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB
BETTER_AUTH_SECRET=replace-with-high-entropy-secret
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
GITHUB_CLIENT_ID=replace-me
GITHUB_CLIENT_SECRET=replace-me
AUTH_EMAIL_FROM=War Brasil <no-reply@example.com>
# RESEND_API_KEY=replace-me   # apenas se Resend for escolhido
```

Nenhuma dessas variáveis deve usar `NEXT_PUBLIC_`.

## 19. Não fazer

MUST NOT:

- criar auth custom do zero sem necessidade;
- confiar em cookie de assento como conta;
- ler cookie HttpOnly via JS;
- colocar segredo em `NEXT_PUBLIC_*`;
- expor config server-side em props/RSC só para o client decidir auth;
- persistir tokens em local/session storage;
- logar body de login/cadastro sem redaction;
- proteger endpoint apenas escondendo botão;
- permitir callback externo arbitrário;
- habilitar `trustedProxyHeaders` ou cross-subdomain cookie por conveniência;
- executar migrations automáticas destrutivas no request path;
- retornar password hash/provider tokens na sessão;
- usar user ID como bearer token/autorização.

## 20. Definition of Done

O usuário consegue clicar em `ENTRAR NO COMANDO`, reutilizar sessão válida ou autenticar-se por modal e continuar para áreas protegidas. A autorização é repetida no servidor, conta e assento permanecem identidades distintas, secrets permanecem exclusivamente server-side, nenhum auth-specific `NEXT_PUBLIC_*` existe, cookies seguem os atributos de segurança definidos e os gates de `EVAL.md` passam em desenvolvimento, CI e build de produção.
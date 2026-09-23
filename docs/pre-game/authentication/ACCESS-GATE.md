# Access Gate — Frontend + Backend

**Escopo:** controle de acesso antes e depois da autenticação.
**Relaciona:** `SPEC.md`, `EVAL.md`, `EMAIL-VERIFICATION-FLOW.md`, `DATABASE-PLAN.md`.

## 1. Regra de produto

Enquanto não houver sessão autenticada válida, a única página de produto navegável do War-Brasil é a **landing (`/`)**. A **Home autenticada (`/home`)** é protegida e representa o Comando depois da entrada.

```text
request de página
      ↓
sessão válida?
   ┌──┴──┐
  não   sim
   ↓     ↓
pathname = / ?    liberar rota solicitada
 ┌─┴─┐
sim não
 ↓   ↓
Home redirect /
```

Isto é um gate de navegação e UX. Não substitui autenticação/autorização server-side.

## 2. Next.js 16: Proxy

O projeto usa Next.js 16.3.4. Nesta versão, o antigo `middleware.ts` chama-se `proxy.ts`.

A implementação SHOULD centralizar a regra de navegação em `proxy.ts`.

### 2.1 Visitante anônimo

Sem sessão válida:

- `/` -> **ALLOW**;
- `/home` sem sessão -> **REDIRECT `/`**;
- qualquer outra página de produto -> **REDIRECT `/`**;
- query/hash do destino protegido MUST NOT ser usado como redirect externo;
- não renderizar parcialmente a página protegida antes do redirect.

Exemplos:

```text
/                 -> allow
/lobby            -> /
/profile          -> /
/game/...         -> /
/rules            -> /
operations/...    -> /
```

A landing continua responsável por abrir o modal de autenticação a partir de `ENTRAR NO COMANDO`. Sessão válida leva para `/home`, onde onboarding ou Comando autorizado são resolvidos.

### 2.2 Usuário autenticado

Com sessão válida:

- `/` continua acessível como landing e não abre automaticamente o Comando;
- `/home` é o destino canônico pós-autenticação;
- páginas protegidas podem ser acessadas;
- regras adicionais continuam aplicáveis (onboarding, ownership de partida, papel/seat, etc.).

Autenticar não significa possuir autorização para qualquer recurso.

## 3. Exceções técnicas ao Proxy

"Somente a Home" significa **somente a Home como página de produto pública**.

O Proxy MUST excluir do bloqueio recursos técnicos necessários para que a aplicação e a autenticação funcionem:

- `/api/auth/*` — handlers/callbacks Better Auth, OAuth, signup/login, verification e password reset;
- `/_next/*` — runtime/static/image pipeline do Next.js;
- arquivos estáticos públicos necessários à própria Home (`favicon`, manifest, imagens/fontes/assets servidos diretamente);
- endpoints estritamente operacionais que sejam deliberadamente públicos, se existirem, sem dados de usuário.

Estas exceções não transformam endpoints em páginas públicas nem dão acesso a dados de negócio.

Nenhuma API de lobby, profile, matchmaking, game, social, economy ou administração entra nessa allowlist.

## 4. Responsabilidade do Proxy

O Proxy é a primeira barreira de navegação.

MUST:

- decidir `allow` vs `redirect /` antes da página protegida;
- evitar lógica de autorização de negócio;
- não consultar PROFILE, partidas, wallet ou dados sociais;
- não confiar em parâmetros vindos do client para declarar autenticação;
- não aceitar `?authenticated=true`, headers client-controlled ou localStorage como prova de sessão;
- nunca ser a única proteção de um recurso.

### 4.1 Validação da sessão

O Proxy faz somente uma checagem **otimista** do cookie de sessão para navegação e redirect. Ele MUST NOT consultar PostgreSQL nem chamar a validação completa de sessão em toda request.

Essa decisão segue diretamente as recomendações oficiais:

- Next.js recomenda, para checks otimistas no Proxy, ler a sessão a partir do cookie e evitar database checks porque o Proxy executa em todas as rotas cobertas, inclusive requests de prefetch;
- Better Auth recomenda `getSessionCookie(request)` para redirects otimistas e alerta que a presença do cookie não valida a sessão;
- como o projeto usa `advanced.cookiePrefix = "war-brasil"`, o mesmo `cookiePrefix` MUST ser informado ao helper do Better Auth.

Portanto, presença de cookie no Proxy significa somente **prosseguir até a validação autoritativa**. Toda página, Route Handler ou operação protegida MUST continuar validando a sessão no servidor perto da fonte de dados.

Referências oficiais:

- https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional
- https://better-auth.com/docs/integrations/next#auth-protection

## 5. Backend Access Middleware

Toda API de negócio protegida MUST atravessar uma boundary server-only comum antes de executar lógica de domínio.

Contrato conceitual:

```text
request
  ↓
requireAuthenticatedSession(request)
  ├── sessão ausente/inválida/revogada -> 401
  └── sessão válida
          ↓
      autorização do recurso
          ├── não autorizado -> 403
          └── autorizado
                  ↓
              handler
```

O nome concreto pode variar, mas o projeto SHOULD possuir uma primitive única, por exemplo:

```ts
requireAuthenticatedSession(request)
requireGameSeat(request, gameId)
```

para impedir que cada endpoint reinvente parsing de cookie/session.

## 6. Backend: 401 x 403

Usar semântica consistente:

- **401 Unauthorized** — não existe sessão válida autenticada;
- **403 Forbidden** — existe sessão válida, mas aquela conta não pode executar a ação/recurso;
- **404 Not Found** MAY substituir 403 quando revelar existência do recurso criar exposição indevida.

APIs MUST retornar resposta de API/JSON apropriada. Não redirecionar APIs protegidas para HTML da Home.

## 7. Backend allowlist pública

Endpoints públicos são exceção explícita, não default.

Permitidos sem sessão somente quando necessários ao fluxo:

```text
/api/auth/*
```

Isso inclui, conforme os endpoints gerados/configurados pelo Better Auth:

- login;
- signup;
- OAuth start/callback;
- verificação de email;
- reenvio de verification;
- recuperação/reset de senha;
- session endpoint quando o próprio Better Auth exigir comportamento público seguro.

Qualquer endpoint adicional sem autenticação MUST ser documentado e coberto por EVAL específico.

Regra default:

```text
/api de negócio -> authenticated by default
```

## 8. Server Components / páginas protegidas

Mesmo com `proxy.ts`, páginas protegidas que carreguem dados server-side MUST validar/reutilizar uma sessão server-side confiável antes de consultar dados sensíveis.

Isto protege contra:

- cookie falso;
- cookie expirado/revogado;
- bypass acidental do matcher;
- acesso direto ao handler;
- regressão futura no Proxy.

Layouts podem compartilhar plumbing, mas autorização sensível não deve depender apenas de um layout ancestral.

## 9. Onboarding

Sessão válida pode existir antes de `profile.commanders` estar completo.

Fluxo:

```text
sessão válida
    ↓
profile completo?
 ┌──┴──┐
não   sim
 ↓     ↓
onboarding  rota solicitada
```

O Proxy de autenticação não precisa conhecer detalhes do PROFILE.

O gate de onboarding fica em uma camada posterior à autenticação e anterior às features que exigem identidade pública completa.

## 10. Game / seat authorization

Autenticação de conta não substitui autorização de partida.

Para recursos de jogo:

```text
sessão Better Auth válida
        ↓
user.id pertence à partida/seat?
    ┌───┴───┐
   não     sim
    ↓       ↓
 403/404   executar comando
```

`war_brasil_player` ou `player_session` sozinho não autentica a conta.

## 11. Realtime / backend separado

Se uma conexão realtime/worker aceitar comandos de usuário, ela MUST aplicar o mesmo princípio:

- autenticar a conta no handshake ou ticket server-issued apropriado;
- associar a identidade interna `auth.user.id` à conexão;
- validar membership/seat antes de comandos de partida;
- não confiar em `userId`, `playerId` ou `roomCode` enviados pelo cliente como prova de identidade;
- desconectar/rejeitar quando a credencial de conexão for inválida.

A estratégia concreta de ticket/handshake será definida junto da integração realtime; não se deve enviar secret Better Auth bruto em payload de jogo sem necessidade.

## 12. Fluxo completo

```text
VISITANTE
   ↓
proxy.ts
   ├── / -> HOME
   └── outra página -> /

LANDING /
   ↓ ENTRAR NO COMANDO
Better Auth
   ├── Google
   ├── Discord
   └── Email + senha
          ↓
      sessão válida
          ↓
        /home
          ↓
      onboarding se necessário
          ↓
      páginas autenticadas
          ↓
      API request
          ↓
requireAuthenticatedSession
          ↓
autorização de domínio/seat
          ↓
         ação
```

## 13. Regras BLOCKER

A implementação não pode ser aprovada se qualquer uma for verdadeira:

- visitante anônimo consegue renderizar página de produto diferente de `/`;
- API de negócio aceita request sem sessão válida;
- proteção depende somente da existência de cookie;
- handler confia em `userId` vindo do cliente em vez de `session.user.id`;
- API protegida redireciona para Home em vez de responder com status de API;
- `/api/auth/*` necessário ao login foi bloqueado pelo Proxy;
- assets necessários à Home foram bloqueados;
- autenticação foi confundida com autorização de partida;
- realtime aceita identidade declarada pelo próprio cliente sem validação server-side.

## 14. Referências

- Next.js — Proxy / Authentication: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Better Auth — Next.js integration / Auth Protection: https://better-auth.com/docs/integrations/next
- Better Auth — Cookies: https://better-auth.com/docs/concepts/cookies

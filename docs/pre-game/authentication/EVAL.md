# EVAL — Authentication / Command Access

Avaliar conforme `SPEC.md`, `PROVIDER-STRATEGY.md`, `DATABASE-PLAN.md`, `../quality-standard.md` e os contratos server/client do projeto.

Aprovação exige **todos os BLOCKERs aplicáveis**. Score de UX não compensa falha de segurança/provider.

## 1. Gates BLOCKER — fluxo funcional

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-01 | `ENTRAR NO COMANDO` reusa sessão válida sem abrir modal | e2e |
| AUTH-02 | sessão ausente abre modal | e2e |
| AUTH-03 | sessão expirada/revogada não abre comando | integration/e2e |
| AUTH-04 | `war_brasil_player` sozinho não autentica conta | integration |
| AUTH-05 | credentials corretas fecham modal e avançam | e2e |
| AUTH-06 | credentials inválidas não enumeram email | e2e/response |
| AUTH-07 | usuário autenticado com profile completo chega a `command-open` | e2e |
| AUTH-08 | usuário autenticado com profile incompleto vai para onboarding | e2e |
| AUTH-09 | erro/cancelamento OAuth é recuperável | e2e/manual |
| AUTH-10 | logout invalida recursos protegidos | integration/e2e |
| AUTH-11 | `/rules` permanece público | e2e |
| AUTH-12 | matchmaking/profile/lobby/game seguem rollout protegido | e2e |
| AUTH-13 | API protegida sem sessão retorna 401/403 | integration |
| AUTH-14 | auth funciona sem depender de Genesis/WebGL/motion | reduced/fallback e2e |

## 2. Gates BLOCKER — providers de launch

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-15 | modal de launch oferece Google, Apple, Discord e credentials | DOM/e2e |
| AUTH-16 | GitHub não aparece no modal nem na config de launch | static/DOM |
| AUTH-17 | Google callback produz sessão válida | staging/provider test |
| AUTH-18 | Apple callback produz sessão válida | staging/provider test |
| AUTH-19 | Discord callback produz sessão válida | staging/provider test |
| AUTH-20 | provider button order/hierarchy segue SPEC sem parede de providers | visual/DOM |
| AUTH-21 | Microsoft/Twitch/Steam/Epic não aparecem sem feature/provider PR específico | static/DOM |

## 3. Google — gates específicos

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-22 | Google usa provider built-in Better Auth | source |
| AUTH-23 | scopes iniciais são somente identidade básica | source/provider config |
| AUTH-24 | Drive/Calendar/Contacts não são pedidos no login | consent screen/source |
| AUTH-25 | provider subject/accountId é usado como identidade externa, não email | integration/schema |
| AUTH-26 | name/avatar Google não sobrescrevem profile público já configurado | integration |

## 4. Apple — gates específicos

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-27 | Apple usa provider built-in Better Auth | source |
| AUTH-28 | Apple web usa Service ID/callback correto | staging/provider config |
| AUTH-29 | teste Apple real usa HTTPS válido; não depende de localhost HTTP | staging |
| AUTH-30 | `APPLE_PRIVATE_KEY` nunca cruza server boundary | bundle/leak scan |
| AUTH-31 | client-secret JWT Apple é gerado/renovável server-side | source/config |
| AUTH-32 | client-secret JWT respeita limite de expiração Apple | config/unit |
| AUTH-33 | `appleid.apple.com` é a única origin adicional introduzida pelo provider Apple | config test |
| AUTH-34 | primeiro consentimento persiste email retornado | provider integration |
| AUTH-35 | relay/private email Apple é aceito como email real/contatável | provider integration |
| AUTH-36 | segundo login Apple funciona quando email não é reenviado | provider regression |
| AUTH-37 | fallback sintético nunca sobrescreve email real Apple já persistido | integration |
| AUTH-38 | provider `sub/accountId` permanece chave externa estável | schema/integration |

## 5. Discord — gates específicos

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-39 | Discord usa provider built-in Better Auth | source |
| AUTH-40 | scopes limitados a identidade básica necessária | source/consent |
| AUTH-41 | `guilds`, bot, activities, connections não são pedidos no login | source/consent |
| AUTH-42 | Discord snowflake/accountId é identidade externa; username não é chave | integration |
| AUTH-43 | conta Discord com email funciona normalmente | provider integration |
| AUTH-44 | conta Discord sem email possui comportamento definido e não quebra silenciosamente | integration/fixture |
| AUTH-45 | fallback interno de email, se necessário, usa domínio `.invalid`/não-entregável | unit/source |
| AUTH-46 | placeholder Discord não recebe verification/reset/magic-link | integration |
| AUTH-47 | placeholder Discord nunca aparece na UI | e2e/network |
| AUTH-48 | placeholder Discord não participa de implicit linking | adversarial integration |
| AUTH-49 | username/global name/avatar Discord não sobrescrevem profile público configurado | integration |

## 6. Account linking — gates

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-50 | account linking está habilitado somente como ação explícita autenticada | source/e2e |
| AUTH-51 | implicit same-email linking está desabilitado | config test |
| AUTH-52 | `trustedProviders` permanece vazio | config/static |
| AUTH-53 | different-email linking só ocorre por usuário já autenticado | integration |
| AUTH-54 | link Apple relay + Google real pode ser feito explicitamente | integration |
| AUTH-55 | link Discord sem email pode ser feito explicitamente quando seguro | integration |
| AUTH-56 | linking não altera handle/displayName/loadout | integration |
| AUTH-57 | usuário não consegue desvincular o último método de acesso | integration |
| AUTH-58 | login por provider não vinculado com email coincidente não faz merge silencioso | adversarial integration |
| AUTH-59 | provider account key é `(providerId, accountId/subject)`, não email | schema/source |

## 7. Providers posteriores / platform identities

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-60 | GitHub não possui env/config operacional no launch | repo/config |
| AUTH-61 | Microsoft só entra após SPEC/EVAL/provider PR | source |
| AUTH-62 | integração Microsoft futura não é tratada como Xbox/XUID automaticamente | architecture review |
| AUTH-63 | Steam não é configurado via Generic OAuth como se fosse OAuth2/OIDC | static/architecture |
| AUTH-64 | SteamID futuro é tratado como platform identity/link, não email | architecture/schema |
| AUTH-65 | Twitch não entra sem caso de produto explícito | source |
| AUTH-66 | Epic/EOS não entra sem integração de plataforma correspondente | source |

## 8. Passkey — gates quando habilitada

Os gates AUTH-67–AUTH-72 são BLOCKER somente no PR que habilitar passkeys.

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-67 | usa plugin oficial Better Auth/WebAuthn | source |
| AUTH-68 | RP ID/origin são explícitos e corretos | config/e2e |
| AUTH-69 | passkey é registrada após identidade interna autenticada | e2e |
| AUTH-70 | passkey não é o único caminho de recovery | product/e2e |
| AUTH-71 | challenge não é persistido/exposto fora do fluxo esperado | security inspection |
| AUTH-72 | login por passkey não altera identidade pública/profile | integration |

## 9. Conta x assento

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-73 | `auth.user` e `player_session` são entidades distintas | schema/source |
| AUTH-74 | `game.players.user_id` referencia auth user conforme rollout | migration |
| AUTH-75 | nova entrada autenticada persiste user correto | integration |
| AUTH-76 | mesma conta não ocupa dois seats da mesma sala | constraint/integration |
| AUTH-77 | conta A + seat B não autoriza B | adversarial integration |
| AUTH-78 | bots permanecem sem conta | integration |
| AUTH-79 | realtime ticket exige conta + seat quando rollout chegar | integration |

## 10. Cookies e sessão

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-80 | auth cookie é HttpOnly | header inspection |
| AUTH-81 | auth cookie é Secure em produção | prod-like test |
| AUTH-82 | SameSite segue policy do SPEC | header |
| AUTH-83 | cookie é host-only por padrão | header/source |
| AUTH-84 | token não aparece em localStorage/sessionStorage/IndexedDB | browser |
| AUTH-85 | token não aparece em HTML/RSC/props | build/e2e |
| AUTH-86 | sessão revogada deixa de autorizar | temporal integration |
| AUTH-87 | duração/cache são versionados em código | source |

## 11. Fronteira server/client

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-88 | Better Auth server vive atrás de `server-only` | source |
| AUTH-89 | módulos `use client` não importam auth server/DB/secret config | static |
| AUTH-90 | auth client não lê env auth | static |
| AUTH-91 | não existe `NEXT_PUBLIC_*` específico de auth | static |
| AUTH-92 | DB URL não entra em módulo/client bundle | source/build |
| AUTH-93 | OAuth/provider secrets não entram no client | bundle scan |
| AUTH-94 | Apple private key/client-secret JWT não entram no client | bundle scan |
| AUTH-95 | realtime/worker signing secrets não vazam | bundle scan |

## 12. Matriz de ambiente obrigatória

### Server-only launch

```text
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_SECRETS            # se rotação usada
BETTER_AUTH_URL

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

APPLE_CLIENT_ID
APPLE_TEAM_ID
APPLE_KEY_ID
APPLE_PRIVATE_KEY
APPLE_APP_BUNDLE_IDENTIFIER   # somente se fluxo nativo exigir

DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET

AUTH_ALLOWED_HOSTS             # se multi-host
AUTH_EMAIL_FROM                # se email transacional
<EMAIL_PROVIDER>_API_KEY / SMTP_URL
```

### MUST NOT existir no launch

```text
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
STEAM_WEB_API_KEY
EPIC_*
```

### Public auth env allowlist

```text
EMPTY
```

## 13. Validação de env

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-96 | produção falha cedo sem Better Auth secret válido | config test |
| AUTH-97 | secret mínimo >= 32 chars e placeholder óbvio rejeitado | config test |
| AUTH-98 | produção falha cedo sem origem auth canônica válida | config test |
| AUTH-99 | Google parcial (ID sem secret ou vice-versa) falha cedo | config test |
| AUTH-100 | Apple parcial (client/team/key/private-key inconsistente) falha cedo | config test |
| AUTH-101 | Discord parcial falha cedo | config test |
| AUTH-102 | email transacional habilitado exige sender + provider secret | config test |
| AUTH-103 | `.env.example` contém placeholders, não secrets | repo inspection |
| AUTH-104 | env reais continuam ignorados pelo Git | gitignore |
| AUTH-105 | auth não usa `NEXT_PUBLIC_SITE_URL` como autoridade quando `BETTER_AUTH_URL` existe | source |
| AUTH-106 | Apple private key não está committed como `.p8` | repo scan |

## 14. Secret leakage build test

CI MUST compilar com sentinels falsos:

```text
BETTER_AUTH_SECRET=AUTH_SENTINEL_NEVER_SHIP
GOOGLE_CLIENT_SECRET=GOOGLE_SENTINEL_NEVER_SHIP
APPLE_PRIVATE_KEY=APPLE_PRIVATE_KEY_SENTINEL_NEVER_SHIP
DISCORD_CLIENT_SECRET=DISCORD_SENTINEL_NEVER_SHIP
DATABASE_URL=postgresql://sentinel:sentinel@host/db
EMAIL_PROVIDER_API_KEY=EMAIL_SENTINEL_NEVER_SHIP
```

Escanear `.next/static`, chunks, client manifests, HTML, RSC/Flight e source maps públicos.

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-107 | Better Auth sentinel ausente do client | CI scan |
| AUTH-108 | DB sentinel ausente | CI scan |
| AUTH-109 | Google secret sentinel ausente | CI scan |
| AUTH-110 | Apple private-key sentinel ausente | CI scan |
| AUTH-111 | Discord secret sentinel ausente | CI scan |
| AUTH-112 | email secret sentinel ausente | CI scan |
| AUTH-113 | leak scanner não ecoa secret no erro | test-of-test |

## 15. Payload seguro

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-114 | sessão client não contém password hash | network |
| AUTH-115 | sessão client não contém OAuth access token | network |
| AUTH-116 | sessão client não contém refresh token | network |
| AUTH-117 | sessão client não contém provider ID token | network |
| AUTH-118 | sessão client não contém Apple key/JWT/provider secret | network |
| AUTH-119 | user ID não é aceito isoladamente como autorização | adversarial |
| AUTH-120 | email só aparece onde necessário | UI/network |
| AUTH-121 | `.invalid` nunca aparece como email real | UI/network |

## 16. OAuth/origin/redirect

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-122 | callback Google corresponde à origem configurada | staging |
| AUTH-123 | callback Apple corresponde à origem configurada | staging |
| AUTH-124 | callback Discord corresponde à origem configurada | staging |
| AUTH-125 | origin não confiável em mutation é rejeitada | adversarial |
| AUTH-126 | callback/returnTo externo arbitrário é rejeitado | adversarial |
| AUTH-127 | localhost não está em trusted origins de produção | config |
| AUTH-128 | `trustedProxyHeaders` não é habilitado sem infra explícita | source/config |
| AUTH-129 | cross-subdomain cookies continuam off | source/header |
| AUTH-130 | scopes são mínimos/versionados em código | source |
| AUTH-131 | `appleid.apple.com` não abre wildcard/broad trust | config |

## 17. Senha, cadastro e reset

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-132 | senha não é persistida/logada em texto puro | source/log |
| AUTH-133 | validação de senha existe no servidor | integration |
| AUTH-134 | email credentials é normalizado no servidor | integration |
| AUTH-135 | credentials seguem verificação de email definida | integration |
| AUTH-136 | reset token é expirável/single-use | integration |
| AUTH-137 | reset é não-enumerável para email inexistente | adversarial |
| AUTH-138 | reset/verification tokens não aparecem em logs | log |
| AUTH-139 | envio de email rejeita placeholder `.invalid` | integration |

## 18. Rate limit e abuso

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-140 | login possui rate limit | integration |
| AUTH-141 | cadastro possui rate limit | integration |
| AUTH-142 | reset/verification possui rate limit | integration |
| AUTH-143 | excesso retorna 429 recuperável | integration |
| AUTH-144 | rate-limit não confia em IP header spoofável | source/infra |
| AUTH-145 | multi-instância não usa contador local inconsistente quando consistência é necessária | architecture |

## 19. Logs e erros

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-146 | Cookie/Authorization são redigidos | log test |
| AUTH-147 | senha/hash/OAuth/reset/verification são redigidos | log test |
| AUTH-148 | Apple private key/client-secret JWT são redigidos | log test |
| AUTH-149 | erros client não retornam SQL/stack/connection string | integration |
| AUTH-150 | debug ID não carrega secret/PII desnecessário | inspection |

## 20. Modal e acessibilidade

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-151 | modal possui dialog semantics e label | a11y/e2e |
| AUTH-152 | foco fica preso no modal | keyboard |
| AUTH-153 | fechar restaura foco ao CTA | keyboard |
| AUTH-154 | Escape funciona quando apropriado | keyboard |
| AUTH-155 | mobile 390x844 sem overflow horizontal | visual/e2e |
| AUTH-156 | pending impede double-submit | e2e |
| AUTH-157 | modal funciona sem WebGL | fallback |
| AUTH-158 | modal funciona em reduced-motion | reduced |
| AUTH-159 | botões de provider possuem labels textuais claros | a11y/DOM |

## 21. Migrations

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-160 | schema auth vem de migration gerenciada | migration/source |
| AUTH-161 | clean install cria schema/tabelas esperadas | db test |
| AUTH-162 | upgrade preserva salas/jogadores | migration integration |
| AUTH-163 | idempotência segue política do projeto | migration integration |
| AUTH-164 | rollback/down não deixa FK inválida quando exigido | migration |
| AUTH-165 | schema Better Auth corresponde à versão fixada | source/CI |

## 22. Testes adversariais obrigatórios

### AUTH-A1 — seat cookie não é login

Manter `war_brasil_player`, limpar auth, clicar CTA. Esperado: modal.

### AUTH-A2 — user ID não é credencial

Enviar ID legítimo sem sessão. Esperado: 401.

### AUTH-A3 — seat swapping

Conta A tenta comando do seat B. Esperado: 403.

### AUTH-A4 — open redirect

Testar destinos externos/encoded (`https://evil.example`, `//evil.example`, versões encoded). Esperado: rejeição/normalização interna.

### AUTH-A5 — untrusted Origin

Mutation com `Origin: https://evil.example`. Esperado: rejeição.

### AUTH-A6 — credential stuffing

Exceder limite de logins inválidos. Esperado: 429 sem enumeração.

### AUTH-A7 — same-email implicit merge

Criar conta por provider A e tentar provider B com mesmo email sem linking autenticado. Esperado: **nenhum merge silencioso**.

### AUTH-A8 — Apple relay mismatch

Conta Apple usa relay; sessão autenticada vincula Google com email real diferente. Esperado: linking explícito permitido, sem duplicar/reescrever profile.

### AUTH-A9 — Discord sem email

Provider retorna ID válido e `email=null`. Esperado: comportamento definido; nenhum placeholder visível/enviado/linkado implicitamente.

### AUTH-A10 — Apple repeat login

Primeiro callback fornece email; callback posterior não fornece. Esperado: mesma conta, email real preservado.

## 23. Inspeção estática obrigatória

```text
[ ] launch providers = google, apple, discord + credentials
[ ] github ausente da config/UI/env de launch
[ ] microsoft/twitch/steam/epic ausentes sem feature específica
[ ] não existe NEXT_PUBLIC_BETTER_AUTH_*
[ ] não existe NEXT_PUBLIC_*_CLIENT_SECRET
[ ] não existe NEXT_PUBLIC_DATABASE_URL
[ ] client auth não lê process.env de auth
[ ] use client não importa auth/server ou DB pool
[ ] server auth possui server-only boundary
[ ] APPLE_PRIVATE_KEY não aparece em arquivo committed/p8
[ ] trustedProviders = []
[ ] disableImplicitLinking = true
[ ] updateUserInfoOnLink = false
[ ] allowUnlinkingAll = false
[ ] scopes Google/Discord são mínimos
[ ] Steam não usa Generic OAuth como adaptação fictícia
[ ] session payload não contém provider tokens
```

## 24. Inspeção dinâmica obrigatória

```text
[ ] document.cookie não revela auth cookie
[ ] localStorage/sessionStorage/IndexedDB não possuem auth token custom
[ ] get-session não retorna tokens sensíveis
[ ] Set-Cookie possui HttpOnly
[ ] produção possui Secure
[ ] logout remove/invalida acesso
[ ] reload restaura sessão válida
[ ] revogação não volta por estado React stale
[ ] Apple first/repeat sign-in convergem para mesma conta
[ ] Discord no-email não exibe placeholder
[ ] linking explícito preserva profile.commanders
```

## 25. Score UX / 100

Aplicado apenas após todos os blockers:

- 25 — fluxo Home → sessão/modal → comando;
- 20 — provider choice/ordem sem poluição visual;
- 15 — desktop/mobile do modal;
- 15 — loading/error/retry claros;
- 10 — acessibilidade teclado/foco;
- 10 — callbacks sem flashes/navegação confusa;
- 5 — observabilidade segura.

Aprovação UX: **>= 85** + blockers.

## 26. Definition of Done

A implementação passa os gates aplicáveis, incluindo provider tests reais em staging para Google/Apple/Discord, testes de Apple sem email em relogin, Discord sem email, explicit account linking, leak scan de Google/Apple/Discord/DB/auth secrets, migrations e browser tests. GitHub não reaparece por herança do Contrapista; Steam/Microsoft/Twitch/Epic permanecem fora até caso de produto e SPEC próprios.
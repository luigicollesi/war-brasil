# EVAL — Authentication / Command Access

Avaliar conforme `SPEC.md`, `PROVIDER-STRATEGY.md`, `DATABASE-PLAN.md`, `DATABASE-EVAL.md` e `../quality-standard.md`.

Aprovação exige **todos os BLOCKERs aplicáveis**. Score visual/UX não compensa falha de segurança, provider ou verificação de email.

## 1. Gates BLOCKER — escopo de providers

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-001 | modal oferece Google | e2e/DOM |
| AUTH-002 | modal oferece Apple | e2e/DOM |
| AUTH-003 | modal oferece Discord | e2e/DOM |
| AUTH-004 | modal oferece Email + senha | e2e/DOM |
| AUTH-005 | não existe quinto provider de login no modal | static/e2e |
| AUTH-006 | GitHub não está configurado/importado como provider | static test |
| AUTH-007 | Microsoft/Steam/Twitch/Epic/passkey não entram nesta implementação | static test |
| AUTH-008 | providers não aprovados não possuem env obrigatória/config ativa | env/config test |

## 2. Gates BLOCKER — Home / Command Access

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-009 | `ENTRAR NO COMANDO` reutiliza sessão válida | e2e |
| AUTH-010 | sessão ausente abre auth modal | e2e |
| AUTH-011 | sessão expirada/revogada não abre Comando | integration/e2e |
| AUTH-012 | `war_brasil_player` sozinho não autentica conta | integration |
| AUTH-013 | sessão válida + perfil completo abre Comando | e2e |
| AUTH-014 | sessão válida + perfil incompleto abre onboarding | e2e |
| AUTH-015 | fluxo auth funciona sem WebGL | fallback e2e |
| AUTH-016 | fluxo auth funciona em reduced-motion | e2e |
| AUTH-017 | erro recuperável de sessão não quebra Home/Genesis | e2e |

## 3. Gates BLOCKER — email + senha / cadastro

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-018 | cadastro valida email/senha/aceite legal no servidor | integration |
| AUTH-019 | signup credentials cria estado não verificado, não sessão | integration + cookie inspection |
| AUTH-020 | signup bem-sucedido dispara email de verificação | integration/email harness |
| AUTH-021 | modal entra em `verification-pending` após signup | e2e |
| AUTH-022 | senha é limpa do estado/formulário após signup | e2e/client inspection |
| AUTH-023 | `command-open` permanece bloqueado após signup não verificado | e2e |
| AUTH-024 | recurso protegido retorna 401/403 para credentials não verificada | integration |
| AUTH-025 | Better Auth é fonte de verdade da verification | source/schema |
| AUTH-026 | não existe tabela custom War-Brasil `email_verification_tokens` | migration/schema/static |
| AUTH-027 | não existe segunda tabela contendo pending password hash | schema/static |
| AUTH-028 | signup duplicado não cria duas contas credentials equivalentes | integration/concurrency |

## 4. Gates BLOCKER — email de verificação

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-029 | token de verificação expira em 3600 s / 1h | config/integration temporal |
| AUTH-030 | email contém CTA de verificação | email snapshot |
| AUTH-031 | email contém link textual fallback | email snapshot |
| AUTH-032 | email informa validade de 1 hora | email snapshot |
| AUTH-033 | email possui HTML e texto simples | email harness |
| AUTH-034 | email informa que pode ser ignorado se cadastro não foi solicitado | email snapshot |
| AUTH-035 | link válido marca email como verificado | integration |
| AUTH-036 | link válido não cria sessão automaticamente | browser/cookie inspection |
| AUTH-037 | após verificação usuário retorna para rota interna permitida/Home | e2e |
| AUTH-038 | Home apresenta sucesso de verificação sem mostrar token | e2e |
| AUTH-039 | token inválido não verifica conta | adversarial integration |
| AUTH-040 | token expirado não verifica conta | temporal integration |
| AUTH-041 | token já utilizado não concede segunda ação privilegiada | replay test |
| AUTH-042 | token/URL de verification não aparece em logs | log inspection |
| AUTH-043 | token não aparece em analytics/telemetria client | network/analytics inspection |
| AUTH-044 | password hash nunca aparece no email/payload | email/network inspection |

## 5. Gates BLOCKER — login credentials após verificação

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-045 | email verificado + senha correta cria sessão | e2e |
| AUTH-046 | email não verificado + senha correta não cria sessão | integration |
| AUTH-047 | senha incorreta não cria sessão | integration |
| AUTH-048 | mensagens não retornam password/hash/details internos | response inspection |
| AUTH-049 | login credentials possui rate limit | integration |
| AUTH-050 | excesso retorna 429 recuperável | integration |

## 6. Gates BLOCKER — reenvio de verification

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-051 | `verification-pending` oferece reenvio explícito | e2e |
| AUTH-052 | reenvio usa API/primitives Better Auth | source |
| AUTH-053 | reenvio não gera token custom War-Brasil | source/schema |
| AUTH-054 | reenvio possui rate limit server-side | integration |
| AUTH-055 | UI possui cooldown contra spam de clique | e2e |
| AUTH-056 | resposta pública de reenvio é não-enumerável | adversarial integration |
| AUTH-057 | reenvio não revela se conta já foi verificada | adversarial integration |
| AUTH-058 | email sintético `.invalid` de Discord nunca recebe verification | integration |
| AUTH-059 | callback de reenvio permanece em allowlist interna | adversarial integration |

## 7. Gates BLOCKER — password reset

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-060 | recuperação de senha existe para credentials | e2e |
| AUTH-061 | reset usa primitive Better Auth | source |
| AUTH-062 | token de reset é expirável | integration temporal |
| AUTH-063 | token de reset é uso único/replay-safe | replay integration |
| AUTH-064 | resposta de forgot-password é não-enumerável | adversarial e2e |
| AUTH-065 | reset token não aparece em logs/analytics | log/network inspection |
| AUTH-066 | senha nova respeita validação server-side | integration |

## 8. Gates BLOCKER — Google

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-067 | Google OAuth produz sessão válida | staging/provider test |
| AUTH-068 | callback Google corresponde ao `BETTER_AUTH_URL` configurado | staging/config |
| AUTH-069 | scopes Google limitados a identidade básica | source/provider inspection |
| AUTH-070 | Google `sub`/account ID é identidade externa; email não autoriza | source/integration |
| AUTH-071 | nome/avatar Google só alimentam sugestão/fallback | integration/source |
| AUTH-072 | Google não solicita Drive/Calendar/Contacts | provider consent inspection |

## 9. Gates BLOCKER — Apple

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-073 | Apple OAuth funciona em ambiente HTTPS real | staging/provider test |
| AUTH-074 | primeiro consentimento com email persiste email/relay corretamente | provider integration |
| AUTH-075 | segundo login Apple funciona mesmo sem novo email no payload | provider integration |
| AUTH-076 | relay Apple não é classificado como placeholder | integration |
| AUTH-077 | provider subject Apple é identidade externa estável | source/integration |
| AUTH-078 | Apple private key nunca cruza server boundary | bundle/leak scan |
| AUTH-079 | configuração Apple ausente/parcial falha cedo quando provider está habilitado | config test |
| AUTH-080 | localhost HTTP não é usado como evidência do provider Apple real | staging runbook |

## 10. Gates BLOCKER — Discord

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-081 | Discord OAuth produz sessão válida | staging/provider test |
| AUTH-082 | scopes Discord limitados a `identify` + `email` quando necessário | source/consent inspection |
| AUTH-083 | Discord user ID é identidade externa; username não é chave | source/integration |
| AUTH-084 | conta Discord phone-only/sem email possui tratamento explícito | integration fixture/provider test |
| AUTH-085 | fallback `.invalid`, se usado, deriva do provider ID | source/integration |
| AUTH-086 | fallback `.invalid` não aparece na PROFILE | e2e/network |
| AUTH-087 | fallback `.invalid` não recebe email de verification/reset | integration |
| AUTH-088 | Discord não solicita guilds/bot/connections/activities | provider consent inspection |

## 11. Gates BLOCKER — account linking

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-089 | linking implícito por email está desabilitado | source/config |
| AUTH-090 | `trustedProviders` não é preenchido silenciosamente | source/config |
| AUTH-091 | Google + Apple relay não fazem merge automático | adversarial integration |
| AUTH-092 | Google + Discord mesmo email não fazem merge automático | adversarial integration |
| AUTH-093 | linking explícito exige sessão autenticada | integration |
| AUTH-094 | linking explícito pode aceitar emails diferentes conforme contrato | integration |
| AUTH-095 | provider vinculado não sobrescreve handle/displayName/loadout | integration |
| AUTH-096 | último método de acesso não pode ser removido sem recuperação aprovada | integration |

## 12. Gates BLOCKER — conta x assento

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-097 | `auth.user` e `player_session` são entidades distintas | schema/source |
| AUTH-098 | `game.players.user_id` referencia conta quando aplicável | migration/integration |
| AUTH-099 | mesma conta não ocupa dois seats na mesma sala | constraint/integration |
| AUTH-100 | conta A + seat de B não autoriza comando de B | adversarial integration |
| AUTH-101 | bots continuam sem auth user | integration |
| AUTH-102 | realtime ticket exige account + seat quando essa fase estiver ativa | integration |

## 13. Gates BLOCKER — sessão/cookies

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-103 | cookie de sessão é HttpOnly | Set-Cookie inspection |
| AUTH-104 | cookie é Secure em produção | prod-like inspection |
| AUTH-105 | SameSite segue policy definida | header inspection |
| AUTH-106 | cookie é host-only por padrão | header inspection |
| AUTH-107 | token não aparece em localStorage | browser inspection |
| AUTH-108 | token não aparece em sessionStorage | browser inspection |
| AUTH-109 | token não aparece em IndexedDB custom | browser inspection |
| AUTH-110 | token não é serializado em HTML/RSC/client props | build inspection |
| AUTH-111 | logout revoga/remove acesso protegido | integration/e2e |
| AUTH-112 | React state stale não mantém acesso após logout | e2e |

## 14. Gates BLOCKER — server/client boundary

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-113 | Better Auth server vive em módulo server-only | static |
| AUTH-114 | módulo `use client` não importa auth server | static |
| AUTH-115 | módulo client não importa DB pool | static |
| AUTH-116 | módulo client não lê env específica de auth | static |
| AUTH-117 | nenhuma auth env usa `NEXT_PUBLIC_` | repo scan |
| AUTH-118 | email sender/transport vive server-side | static |
| AUTH-119 | session payload não contém provider tokens | network inspection |
| AUTH-120 | client auth user não carrega secrets/hashes | contract/network |

## 15. Matriz de ambiente obrigatória

### Server-only

```text
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_SECRETS            # apenas se rotação for usada
BETTER_AUTH_URL

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

APPLE_CLIENT_ID
APPLE_TEAM_ID
APPLE_KEY_ID
APPLE_PRIVATE_KEY
APPLE_APP_BUNDLE_IDENTIFIER    # somente se fluxo Apple nativo for implementado

DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET

AUTH_ALLOWED_HOSTS             # quando aplicável
AUTH_EMAIL_FROM
<EMAIL_TRANSPORT_SECRET>
SMTP_URL                        # somente se SMTP for usado
```

### Auth-specific public env allowlist

```text
EMPTY
```

### Proibidas nesta fase

```text
GITHUB_*
MICROSOFT_*
STEAM_*
TWITCH_*
EPIC_*
PASSKEY_*
```

## 16. Gates BLOCKER — env/config

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-121 | produção falha cedo sem Better Auth secret válido | config test |
| AUTH-122 | secret de auth possui entropia/comprimento mínimo aceito pela versão pinada | config test |
| AUTH-123 | `BETTER_AUTH_URL` é explícita em produção | config test |
| AUTH-124 | Google habilitado exige ID + secret completos | config test |
| AUTH-125 | Apple habilitado exige configuração completa necessária | config test |
| AUTH-126 | Discord habilitado exige ID + secret completos | config test |
| AUTH-127 | email transport habilitado exige remetente + credential | config test |
| AUTH-128 | `.env.example` possui apenas placeholders | repo inspection |
| AUTH-129 | arquivos env reais continuam ignorados | gitignore test |
| AUTH-130 | não existem env de providers fora do escopo | repo/config scan |

## 17. Gates BLOCKER — leak scan

Build CI MUST usar sentinels falsos, nunca secrets reais, por exemplo:

```text
BETTER_AUTH_SECRET=AUTH_SENTINEL_DO_NOT_SHIP
GOOGLE_CLIENT_SECRET=GOOGLE_SENTINEL_DO_NOT_SHIP
APPLE_PRIVATE_KEY=APPLE_PRIVATE_KEY_SENTINEL_DO_NOT_SHIP
DISCORD_CLIENT_SECRET=DISCORD_SENTINEL_DO_NOT_SHIP
EMAIL_TRANSPORT_SECRET=EMAIL_SENTINEL_DO_NOT_SHIP
DATABASE_URL=postgresql://sentinel:sentinel@invalid/db
```

Scan obrigatório em `.next/static/**`, chunks, HTML, RSC/Flight e sourcemaps públicos.

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-131 | auth secret ausente dos artefatos client | CI scan |
| AUTH-132 | DB credential ausente dos artefatos client | CI scan |
| AUTH-133 | Google secret ausente | CI scan |
| AUTH-134 | Apple private key ausente | CI scan |
| AUTH-135 | Discord secret ausente | CI scan |
| AUTH-136 | email transport secret ausente | CI scan |
| AUTH-137 | leak scanner não imprime o próprio secret ao falhar | test-of-test |

## 18. Gates BLOCKER — origem/redirect

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-138 | origin não confiável em mutation auth é rejeitada | adversarial integration |
| AUTH-139 | `returnTo` externo arbitrário é rejeitado | adversarial integration |
| AUTH-140 | verification callback é interno/allowlisted | source/e2e |
| AUTH-141 | trustedProxyHeaders não é habilitado sem contrato infra | config/source |
| AUTH-142 | cross-subdomain cookie continua desligado inicialmente | config/header |
| AUTH-143 | localhost não consta em trusted origins de produção | prod config test |

## 19. Gates BLOCKER — rate limit/abuso

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-144 | cadastro possui rate limit | integration |
| AUTH-145 | login possui rate limit | integration |
| AUTH-146 | resend verification possui rate limit | integration |
| AUTH-147 | forgot/reset possui rate limit | integration |
| AUTH-148 | limite não depende de IP header spoofável sem proxy confiável | source/infra |
| AUTH-149 | produção multi-instância usa estratégia consistente quando necessário | architecture |

## 20. Gates BLOCKER — logs/erros

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-150 | Cookie/Authorization são redigidos | log test |
| AUTH-151 | password/hash são redigidos | log test |
| AUTH-152 | OAuth codes/tokens são redigidos | log test |
| AUTH-153 | verification/reset tokens e URLs são redigidos | log test |
| AUTH-154 | Apple private key/provider secrets são redigidos | log test |
| AUTH-155 | erro client não contém SQL/stack/connection string | integration |
| AUTH-156 | email sender failure não retorna provider credential/detail | integration |

## 21. Gates BLOCKER — modal/acessibilidade

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-157 | dialog possui nome acessível | a11y/e2e |
| AUTH-158 | foco permanece preso enquanto modal está aberto | keyboard e2e |
| AUTH-159 | fechamento restaura foco a `ENTRAR NO COMANDO` | keyboard e2e |
| AUTH-160 | Escape funciona quando permitido | keyboard e2e |
| AUTH-161 | pending impede double-submit | e2e |
| AUTH-162 | mobile 390x844 não possui overflow horizontal | visual/e2e |
| AUTH-163 | `verification-pending` é legível no mobile | visual/e2e |
| AUTH-164 | provider buttons têm labels textuais acessíveis | a11y |
| AUTH-165 | auth continua funcional sem animação/cena | fallback/reduced e2e |

## 22. Gates BLOCKER — migrations / schema

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-166 | schema Better Auth é criado por migration gerenciada | migration/source |
| AUTH-167 | clean install cria estruturas esperadas | DB test |
| AUTH-168 | upgrade preserva game state existente | migration integration |
| AUTH-169 | schema de verification é o esperado da versão Better Auth pinada | schema contract |
| AUTH-170 | não há tabela paralela de pending credentials | schema inspection |
| AUTH-171 | profile/economy/social seguem `DATABASE-EVAL.md` quando integrados | DB eval |

## 23. Testes adversariais obrigatórios

### AUTH-A1 — seat cookie não é login

Manter `war_brasil_player`, apagar auth session, clicar `ENTRAR NO COMANDO`. Esperado: modal.

### AUTH-A2 — credentials não verificada

Cadastrar email/senha e tentar acessar `/matchmaking` antes do clique no email. Esperado: sem acesso.

### AUTH-A3 — verification replay

Usar link válido e reutilizar o mesmo link. Esperado: não produzir segundo efeito privilegiado nem sessão.

### AUTH-A4 — token expirado

Avançar clock além de 1h. Esperado: conta continua não verificada e UI recuperável oferece reenvio.

### AUTH-A5 — resend enumeration

Solicitar reenvio para email existente, verificado, não existente e malformed-valid-looking. Respostas públicas não podem revelar status da conta.

### AUTH-A6 — implicit provider merge

Criar conta credentials/Google e tentar login Apple/Discord com email equivalente mas account diferente. Esperado: nenhuma fusão silenciosa.

### AUTH-A7 — Apple relay

Linkar Apple com relay a conta que também possui Google com email real. Esperado: uma conta somente após linking explícito; relay preservado na identidade Apple.

### AUTH-A8 — Discord sem email

Provider fixture retorna ID válido e email ausente. Esperado: tratamento definido no SPEC, sem envio de email para placeholder e sem email falso na PROFILE.

### AUTH-A9 — open redirect

Testar:

```text
https://evil.example
//evil.example
/%2f%2fevil.example
https:%2f%2fevil.example
```

Esperado: rejeitado/normalizado para rota interna permitida.

### AUTH-A10 — user ID não é credencial

Enviar `auth.user.id` conhecido em body/header sem sessão. Esperado: 401.

### AUTH-A11 — seat swapping

Conta A tenta comando com seat B. Esperado: 403.

## 24. Inspeção estática obrigatória

```text
[ ] providers de launch = google, apple, discord, credentials
[ ] não existe provider GitHub
[ ] não existe quinto provider
[ ] não existe NEXT_PUBLIC_* de auth
[ ] não existe tabela custom email_verification_tokens do War-Brasil
[ ] não existe pending password hash paralelo
[ ] emailAndPassword exige verification
[ ] auto sign-in no signup credentials está desabilitado
[ ] auto sign-in pós-verification está desabilitado
[ ] verification TTL = 3600s
[ ] sendOnSignUp está habilitado
[ ] resend usa Better Auth
[ ] módulos client não importam server auth/DB/email secrets
[ ] provider tokens não entram no session payload
[ ] linking implícito por email está desligado
[ ] trustedProviders está vazio
[ ] trustedProxyHeaders continua desligado/ausente
[ ] callback/returnTo possui allowlist interna
```

## 25. Inspeção dinâmica obrigatória

```text
[ ] signup credentials envia email
[ ] signup credentials não seta cookie de sessão
[ ] verification válida muda emailVerified
[ ] verification válida não seta sessão automaticamente
[ ] verification inválida/expirada não confirma conta
[ ] login após verification funciona
[ ] reload restaura sessão válida
[ ] logout remove acesso
[ ] document.cookie não revela auth session token
[ ] localStorage/sessionStorage/IndexedDB não contêm auth token
[ ] email HTML/text não contêm password/hash
[ ] browser não recebe provider access/refresh token
```

## 26. Score UX / 100

Somente depois de todos os blockers:

- 25 — Home → login → onboarding/Comando sem atrito;
- 20 — fluxo Email + senha → verificação claro;
- 15 — qualidade visual do modal desktop/mobile;
- 15 — Google/Apple/Discord consistentes;
- 10 — acessibilidade/foco/teclado;
- 10 — estados error/retry/resend;
- 5 — observabilidade segura.

Aprovação UX: **>= 85**.

## 27. Definition of Done

O launch expõe exclusivamente Google, Apple, Discord e Email + senha. Credentials não autentica até que o usuário confirme, por link de 1 hora, o email enviado no cadastro. O clique verifica mas não auto-loga, replicando a experiência do Contrapista com primitives nativas do Better Auth. Reenvio/reset são seguros e rate-limited, OAuth não faz merge implícito por email, secrets não cruzam a fronteira do servidor e todos os gates deste EVAL e do `DATABASE-EVAL.md` aplicável estão verdes.

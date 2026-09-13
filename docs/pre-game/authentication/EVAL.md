# EVAL — Authentication / Command Access

Avaliar conforme `SPEC.md`, `../quality-standard.md` e os contratos server/client do projeto.

Aprovação exige **todos os BLOCKERs** abaixo. Score visual/UX não compensa falha de segurança.

## 1. Gates BLOCKER — fluxo funcional

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-01 | `ENTRAR NO COMANDO` reusa sessão válida sem abrir modal | e2e |
| AUTH-02 | sessão ausente abre modal de autenticação | e2e |
| AUTH-03 | sessão expirada/revogada não abre o comando | integration/e2e |
| AUTH-04 | cookie `war_brasil_player` sozinho não autentica conta | integration |
| AUTH-05 | login email/senha correto fecha modal e abre comando | e2e |
| AUTH-06 | credenciais inválidas não revelam se email existe | e2e + response inspection |
| AUTH-07 | Google OAuth retorna para a aplicação e produz sessão válida | provider test/manual staging |
| AUTH-08 | GitHub OAuth retorna para a aplicação e produz sessão válida | provider test/manual staging |
| AUTH-09 | cancelamento/erro OAuth retorna a estado recuperável sem quebrar Home | e2e/manual |
| AUTH-10 | logout invalida sessão e recursos protegidos deixam de autorizar | integration/e2e |
| AUTH-11 | `/rules` permanece público | e2e |
| AUTH-12 | `/matchmaking`, `/profile`, lobby e game exigem conta conforme rollout definido | e2e |
| AUTH-13 | API protegida chamada diretamente sem sessão retorna 401/403 apropriado | integration |
| AUTH-14 | navegação/redirect de auth não depende da Genesis, WebGL ou motion | e2e reduced/fallback |

## 2. Gates BLOCKER — conta x assento

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-15 | `auth user` e `player_session` são entidades distintas | schema + source |
| AUTH-16 | `game.players.user_id` é nullable apenas durante rollout/bots e referencia usuário auth | migration test |
| AUTH-17 | nova entrada autenticada em sala persiste `user_id` do usuário correto | integration |
| AUTH-18 | mesma conta não ocupa dois assentos na mesma sala | constraint/integration |
| AUTH-19 | conta A + `player_session` de B não autoriza comandos do assento B | integration adversarial |
| AUTH-20 | bots permanecem sem identidade de conta | integration |
| AUTH-21 | realtime ticket só é emitido após validação de conta + assento quando a integração chegar a essa fase | integration |

## 3. Gates BLOCKER — cookies e sessão

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-22 | cookie de sessão de auth é `HttpOnly` | `Set-Cookie` inspection |
| AUTH-23 | cookie de sessão é `Secure` em produção | prod-like integration |
| AUTH-24 | cookie usa `SameSite=Lax` ou política mais restritiva compatível | header inspection |
| AUTH-25 | cookie é host-only por padrão; não existe domain amplo sem SPEC novo | header/source |
| AUTH-26 | token de sessão não aparece em `localStorage`, `sessionStorage` ou IndexedDB | browser inspection |
| AUTH-27 | token de sessão não é serializado em HTML/RSC/props do client | build/e2e inspection |
| AUTH-28 | sessão revogada no servidor deixa de autorizar após janela de cache definida | integration temporal |
| AUTH-29 | duração/cache de sessão são constantes versionadas em código, não env arbitrária | source inspection |

## 4. Gates BLOCKER — fronteira server/client

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-30 | instância Better Auth server-side vive em módulo `server-only` ou barreira equivalente | source |
| AUTH-31 | nenhum módulo `"use client"` importa auth server, DB pool ou secret config | static test |
| AUTH-32 | auth client não lê `process.env` de autenticação | static test |
| AUTH-33 | nenhuma variável `NEXT_PUBLIC_*` específica de auth é introduzida | static test |
| AUTH-34 | `DATABASE_URL` não é importada/referenciada por módulo client | source/build |
| AUTH-35 | OAuth client secrets não existem em client bundle | production bundle scan |
| AUTH-36 | auth secret(s) não existem em client bundle | production bundle scan |
| AUTH-37 | email provider/SMTP secrets não existem em client bundle | production bundle scan |
| AUTH-38 | realtime/worker signing secrets não vazam por integração de auth | production bundle scan |

## 5. Matriz de ambiente obrigatória

O build/config validator MUST classificar explicitamente as variáveis abaixo.

### Server-only

```text
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_SECRETS            (quando rotação for usada)
BETTER_AUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
AUTH_ALLOWED_HOSTS             (quando multi-host for usado)
AUTH_EMAIL_FROM                (quando email transacional for habilitado)
<EMAIL_PROVIDER>_API_KEY       (provider escolhido)
SMTP_URL                       (se SMTP for escolhido)
```

### Auth-specific public env allowlist

```text
EMPTY
```

Qualquer `NEXT_PUBLIC_*` novo com significado de autenticação reprova até o SPEC/EVAL ser deliberadamente alterado.

## 6. Gates BLOCKER — validação de env

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-39 | produção falha cedo sem `BETTER_AUTH_SECRET`/estratégia de secrets válida | config test |
| AUTH-40 | secret possui mínimo de 32 caracteres e teste rejeita placeholder óbvio em produção | config test |
| AUTH-41 | produção falha cedo sem origem auth canônica/estratégia multi-host válida | config test |
| AUTH-42 | Google habilitado exige ID + secret; config parcial falha cedo | config test |
| AUTH-43 | GitHub habilitado exige ID + secret; config parcial falha cedo | config test |
| AUTH-44 | email habilitado exige remetente + segredo do provider | config test |
| AUTH-45 | `.env.example` contém placeholders, nunca credenciais reais | repo inspection |
| AUTH-46 | `.env`, `.env.local` e arquivos reais de produção permanecem ignorados pelo Git | gitignore test |
| AUTH-47 | auth não usa `NEXT_PUBLIC_SITE_URL` como fonte autoritativa quando `BETTER_AUTH_URL` existe | source test |

## 7. Gates BLOCKER — secret leakage test

CI MUST possuir um teste de build com valores-sentinela que nunca correspondam a secrets reais.

Exemplo conceitual:

```text
BETTER_AUTH_SECRET=AUTH_SENTINEL_NEVER_SHIP_...
GOOGLE_CLIENT_SECRET=GOOGLE_SECRET_SENTINEL_...
GITHUB_CLIENT_SECRET=GITHUB_SECRET_SENTINEL_...
DATABASE_URL=postgresql://sentinel:sentinel@...
EMAIL_PROVIDER_API_KEY=EMAIL_SECRET_SENTINEL_...
```

Depois de `next build`, o teste MUST verificar ausência dos valores-sentinela em:

- `.next/static/**`;
- chunks/client manifests relevantes;
- HTML estático gerado;
- payloads RSC/flight materializados pelo harness;
- source maps públicos, se habilitados.

MUST NOT imprimir o valor completo do sentinel/secret em logs em caso de falha; o teste deve reportar somente `secret class + artifact path`.

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-48 | sentinel de auth secret ausente de artefatos client | CI build scan |
| AUTH-49 | sentinel de DB credential ausente de artefatos client | CI build scan |
| AUTH-50 | sentinels OAuth secrets ausentes de artefatos client | CI build scan |
| AUTH-51 | sentinel de email secret ausente de artefatos client | CI build scan |
| AUTH-52 | falha do leak scanner não ecoa o segredo | test of test/log inspection |

## 8. Gates BLOCKER — payload seguro

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-53 | sessão client não contém password hash | network inspection |
| AUTH-54 | sessão client não contém OAuth access token | network inspection |
| AUTH-55 | sessão client não contém OAuth refresh token | network inspection |
| AUTH-56 | sessão client não contém provider ID token | network inspection |
| AUTH-57 | sessão client não contém DB/provider secret | network inspection |
| AUTH-58 | user ID exposto não é aceito isoladamente como autorização | adversarial integration |
| AUTH-59 | email só aparece em superfícies autenticadas que realmente precisam dele | UI/network inspection |

## 9. Gates BLOCKER — OAuth/origin/redirect

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-60 | callback Google corresponde à origem configurada | staging/provider test |
| AUTH-61 | callback GitHub corresponde à origem configurada | staging/provider test |
| AUTH-62 | origin não confiável em mutation de auth é rejeitada | adversarial integration |
| AUTH-63 | callback/`returnTo` externo arbitrário é rejeitado | adversarial integration |
| AUTH-64 | localhost não consta nos trusted origins de produção | prod config test |
| AUTH-65 | `trustedProxyHeaders` não é habilitado sem contrato infra explícito | source/config test |
| AUTH-66 | cross-subdomain cookies permanecem desligados na primeira versão | source/header |
| AUTH-67 | scopes OAuth são mínimos e versionados em código | source inspection |
| AUTH-68 | account linking permissivo/trusted provider não é ativado silenciosamente | source inspection |

## 10. Gates BLOCKER — senha, cadastro e reset

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-69 | senha não é persistida/logada em texto puro | source/log test |
| AUTH-70 | validação de senha existe no servidor | integration |
| AUTH-71 | email é normalizado no servidor | integration |
| AUTH-72 | conta credentials exige verificação de email conforme policy final | integration |
| AUTH-73 | token de reset é expirável e de uso único | integration |
| AUTH-74 | reset de senha responde de forma não enumerável para email inexistente | adversarial e2e |
| AUTH-75 | verification/reset tokens não aparecem em logs | log inspection |
| AUTH-76 | falha de email não vaza stack/API key/provider detail ao browser | integration |

## 11. Gates BLOCKER — rate limit e abuso

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-77 | login possui rate limit | integration |
| AUTH-78 | cadastro possui rate limit | integration |
| AUTH-79 | reset/verification possui rate limit | integration |
| AUTH-80 | excesso retorna `429` recuperável | integration |
| AUTH-81 | rate-limit não depende de IP header facilmente spoofável | source/infra test |
| AUTH-82 | produção multi-instância não depende de contador local inconsistente quando consistency for requerida | architecture/source |

## 12. Gates BLOCKER — logs e erros

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-83 | `Cookie`/`Authorization` são redigidos | log test |
| AUTH-84 | senha/hash/token OAuth/reset/verification são redigidos | log test |
| AUTH-85 | erros client não retornam SQL/connection string/stack | integration |
| AUTH-86 | debug ID pode existir sem carregar secret/PII desnecessário | response/log inspection |

## 13. Gates BLOCKER — modal e acessibilidade

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-87 | modal possui semântica de dialog e label acessível | a11y/e2e |
| AUTH-88 | foco fica preso no modal enquanto aberto | keyboard e2e |
| AUTH-89 | fechar modal restaura foco a `ENTRAR NO COMANDO` | keyboard e2e |
| AUTH-90 | Escape fecha quando não há operação irreversível/pending que o impeça | keyboard e2e |
| AUTH-91 | mobile 390x844 não possui overflow horizontal | visual/e2e |
| AUTH-92 | pending desabilita double-submit | e2e |
| AUTH-93 | modal funciona com WebGL indisponível | fallback e2e |
| AUTH-94 | modal funciona em reduced-motion | reduced e2e |

## 14. Gates BLOCKER — migrations

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AUTH-95 | schema `auth` é criado por migration gerenciada, não request runtime | migration/source |
| AUTH-96 | clean install cria schema/tabelas esperadas | `npm run test:db` |
| AUTH-97 | upgrade de baseline existente preserva salas/jogadores | migration integration |
| AUTH-98 | migration pode rodar novamente conforme política de idempotência do projeto | migration integration |
| AUTH-99 | rollback/down migration, se o padrão da pasta exigir, não deixa FK inválida | migration integration |
| AUTH-100 | schema gerado pelo Better Auth e migration aplicada são revisados para a versão fixada | source/CI contract |

## 15. Testes adversariais obrigatórios

### AUTH-A1 — Cookie de assento não é login

1. Limpar sessão auth.
2. Manter `war_brasil_player` válido.
3. Clicar `ENTRAR NO COMANDO`.
4. Esperado: modal de auth.

### AUTH-A2 — User ID não é credencial

1. Descobrir ID legítimo de conta via própria sessão/UI.
2. Enviar request protegido com esse ID no body/header, sem sessão auth.
3. Esperado: 401.

### AUTH-A3 — Seat swapping

1. Autenticar conta A.
2. Obter `player_session`/contexto de seat B em fixture de teste.
3. Executar comando como A usando B.
4. Esperado: 403/authorization failure.

### AUTH-A4 — Open redirect

Tentar callbacks como:

```text
https://evil.example
//evil.example
/%2f%2fevil.example
https:%2f%2fevil.example
```

Esperado: rejeição ou normalização para destino interno permitido.

### AUTH-A5 — Origin não confiável

Mutation de auth com `Origin: https://evil.example`.

Esperado: rejeitada.

### AUTH-A6 — Credential stuffing básico

Repetir login inválido acima do limite configurado.

Esperado: 429 sem indicar existência de usuário.

## 16. Inspeção estática obrigatória

```text
[ ] não existe NEXT_PUBLIC_BETTER_AUTH_*
[ ] não existe NEXT_PUBLIC_GOOGLE_CLIENT_SECRET
[ ] não existe NEXT_PUBLIC_GITHUB_CLIENT_SECRET
[ ] não existe NEXT_PUBLIC_DATABASE_URL
[ ] client auth não lê process.env
[ ] módulos use client não importam src/lib/auth/server
[ ] módulos use client não importam pool PostgreSQL
[ ] server auth possui server-only boundary
[ ] nenhum segredo real está commitado
[ ] .env.example contém somente placeholders
[ ] trustedProxyHeaders continua false/ausente
[ ] crossSubDomainCookies continua false/ausente
[ ] callback/returnTo possui allowlist interna
[ ] session payload não possui provider tokens
```

## 17. Inspeção dinâmica obrigatória

No navegador e harness de rede:

```text
[ ] document.cookie não revela cookie de sessão auth
[ ] localStorage não possui auth token
[ ] sessionStorage não possui auth token
[ ] IndexedDB não possui auth token custom
[ ] /api/auth/session/get-session não retorna tokens sensíveis
[ ] Set-Cookie possui HttpOnly
[ ] produção possui Secure
[ ] logout remove/invalida acesso
[ ] reload restaura sessão válida
[ ] sessão revogada não volta por estado React stale
```

## 18. Score de UX / 100

Aplicado somente após todos os BLOCKERs de segurança passarem:

- 25 — fluxo Home → sessão/modal → comando sem atrito;
- 20 — qualidade desktop/mobile do modal;
- 15 — estados loading/error/retry claros;
- 15 — acessibilidade teclado/foco;
- 10 — OAuth/callback sem flashes ou navegação confusa;
- 10 — integração visual com Foundation;
- 5 — observabilidade segura e mensagens úteis.

Aprovação UX: **>= 85**, além dos blockers.

## 19. Definition of Done

A implementação passa os 100 gates aplicáveis deste EVAL, os testes adversariais, o leak scan de build, migrations e browser tests. Nenhuma credencial ou secret cruza a fronteira client, nenhuma rota protegida depende somente da Home para segurança, e o fluxo de autenticação permanece funcional com reload, reduced-motion, fallback WebGL e logout.
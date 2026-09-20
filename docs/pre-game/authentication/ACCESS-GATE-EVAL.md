# EVAL — Access Gate / Frontend + Backend

Avaliar conforme `ACCESS-GATE.md`, `SPEC.md`, `EVAL.md` e os contratos server/client do projeto.

A aprovação exige todos os BLOCKERs aplicáveis.

## 1. Frontend / Proxy

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AG-FE-01 | visitante sem sessão acessa `/` | teste de navegação |
| AG-FE-02 | visitante sem sessão em `/lobby` é redirecionado para `/` | integração/e2e |
| AG-FE-03 | visitante sem sessão em `/profile` é redirecionado para `/` | integração/e2e |
| AG-FE-04 | visitante sem sessão em rota de jogo protegida é redirecionado para `/` | integração/e2e |
| AG-FE-05 | página protegida não renderiza conteúdo sensível antes do redirect | e2e/snapshot |
| AG-FE-06 | usuário autenticado continua podendo acessar `/` | integração/e2e |
| AG-FE-07 | usuário autenticado acessa rota protegida compatível com seu estado | integração/e2e |
| AG-FE-08 | `/_next/*` e assets necessários à Home não são bloqueados | build/e2e |
| AG-FE-09 | `/api/auth/*` necessário ao Better Auth não é bloqueado | integração OAuth/credentials |
| AG-FE-10 | parâmetros/client storage não conseguem declarar autenticação | teste negativo |

## 2. Sessão real x cookie

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AG-SESSION-01 | cookie inexistente é tratado como anônimo | teste |
| AG-SESSION-02 | cookie inválido/falsificado não concede recurso protegido | teste negativo |
| AG-SESSION-03 | sessão expirada/revogada não concede recurso protegido | integração |
| AG-SESSION-04 | nenhum backend considera somente presença de cookie como autenticação suficiente | revisão estrutural/teste |
| AG-SESSION-05 | `session.user.id` é a identidade autoritativa derivada do servidor | teste/revisão |

## 3. Backend middleware

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AG-BE-01 | API de negócio sem sessão responde 401 | integração |
| AG-BE-02 | API de negócio com sessão válida entra no handler | integração |
| AG-BE-03 | sessão válida sem permissão responde 403 ou 404 conforme política | integração |
| AG-BE-04 | API protegida não responde redirect HTML para `/` | integração |
| AG-BE-05 | handlers compartilham primitive comum de autenticação em vez de parsing duplicado | inspeção estrutural |
| AG-BE-06 | `userId` enviado pelo cliente não substitui `session.user.id` | teste negativo |
| AG-BE-07 | rota pública adicional exige allowlist/documentação explícita | inspeção |
| AG-BE-08 | endpoints Better Auth continuam públicos somente na medida necessária ao fluxo | integração |

## 4. Autorização de domínio

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AG-AUTHZ-01 | autenticação não implica ownership de partida | teste negativo |
| AG-AUTHZ-02 | comando de jogo valida membership/seat server-side | integração |
| AG-AUTHZ-03 | `player_session`, `roomCode`, `playerId` ou similares vindos do cliente não são prova de conta | teste negativo |
| AG-AUTHZ-04 | recurso inexistente/sensível pode usar 404 em vez de revelar existência por 403 | teste conforme endpoint |

## 5. Onboarding

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AG-ONB-01 | sessão válida com profile incompleto entra no gate de onboarding | integração/e2e |
| AG-ONB-02 | Proxy não precisa consultar PROFILE para decidir autenticação | inspeção |
| AG-ONB-03 | profile incompleto não é confundido com usuário anônimo | integração |

## 6. Realtime

Aplicável quando a integração realtime receber identidade de conta.

| ID | Critério | Evidência mínima |
| --- | --- | --- |
| AG-RT-01 | conexão sem credencial válida é rejeitada | integração |
| AG-RT-02 | identidade da conexão é derivada server-side | integração |
| AG-RT-03 | payload não consegue impersonar outro `userId`/`playerId` | teste negativo |
| AG-RT-04 | comandos de partida validam membership/seat | integração |

## 7. Casos de ataque obrigatórios

Testar ao menos:

```text
1. abrir /lobby em janela anônima
2. abrir /profile em janela anônima
3. criar cookie com nome parecido ao de sessão, mas valor aleatório
4. reutilizar cookie de sessão revogada
5. chamar API protegida diretamente sem passar pela UI
6. chamar API protegida com userId de outra conta no body/query
7. tentar acessar partida de outro usuário com sessão válida
8. confirmar que /api/auth/* continua operacional sem sessão
```

Resultados esperados:

- páginas -> `/` quando não autenticado;
- APIs -> 401 quando não autenticado;
- APIs -> 403/404 quando autenticado sem autorização;
- nenhuma elevação de privilégio por dados enviados pelo cliente.

## 8. Gates BLOCKER

Falha automática se:

- qualquer página de produto além da Home for pública sem decisão explícita;
- uma API de negócio puder executar sem sessão Better Auth válida;
- `proxy.ts` for tratado como única fronteira de segurança;
- backend confiar em cookie não validado;
- backend confiar em identidade enviada pelo cliente;
- `/api/auth/*` for acidentalmente bloqueado;
- uma resposta de API protegida virar redirect HTML;
- autenticação e autorização de partida estiverem colapsadas em um único booleano.

## 9. Evidência de implementação esperada

Quando o código for implementado, o PR SHOULD mostrar:

- `proxy.ts` com matcher/allowlist explícitos;
- primitive server-only de sessão (`requireAuthenticatedSession` ou equivalente);
- primitive de autorização de partida/seat separada;
- testes unitários/integrados para 401/403/redirect;
- pelo menos um E2E anônimo provando que só `/` é navegável;
- teste de cookie falso/revogado;
- documentação de qualquer exceção pública adicional.

# Estratégia de Providers — Authentication / War-Brasil

**Branch:** `feature/auth-command-access`  
**Relaciona:** `SPEC.md`, `EVAL.md`, `DATABASE-PLAN.md`.  
**Objetivo:** escolher provedores de autenticação pela aderência a um jogo multiplataforma, segurança, qualidade da identidade, suporte no Better Auth e custo operacional — não apenas pela conveniência de implementação.

## 1. Decisão resumida

### Launch / Tier 1

1. **Google** — provider generalista principal;
2. **Apple** — provider de privacidade/mobile e preparação para distribuição Apple;
3. **Discord** — provider social nativo do público gamer;
4. **email + senha** — fallback independente de plataforma/provider.

### Pós-login / Tier 1.5

- **Passkey/WebAuthn** — SHOULD ser oferecido depois que a conta estiver autenticada e o perfil público estiver provisionado, como método de retorno rápido e resistente a phishing.

### Candidatos Tier 2

- **Microsoft** — excelente candidato quando houver foco Windows/Xbox/Game Pass ou benefício real de identidade Microsoft;
- **Twitch** — candidato quando houver integração de streaming/comunidade que justifique o provider.

### Conta vinculada / integração de plataforma

- **Steam** — SHOULD ser tratado primeiro como identidade de plataforma vinculada e, futuramente, SSO específico da distribuição Steam;
- **Epic/EOS** — somente quando o produto realmente adotar Epic Online Services/Epic Games Store;
- Xbox/XUID, SteamID e outras identidades de plataforma não substituem automaticamente `auth.user.id`.

### Não entra no launch

- **GitHub** — removido do plano inicial. É coerente com ferramentas de desenvolvimento, mas não com a identidade primária de jogador do War-Brasil;
- Facebook/TikTok/Spotify/Roblox/Kick e outros providers suportados pelo Better Auth não entram sem evidência de audiência/produto que justifique a complexidade adicional.

## 2. Critérios de decisão

Cada provider é avaliado por:

- cobertura provável da audiência;
- afinidade com jogos/comunidade;
- suporte oficial/built-in no Better Auth;
- protocolo moderno e manutenção;
- existência de identificador estável do provider;
- confiabilidade/disponibilidade de email;
- UX em web e possível app nativo futuro;
- complexidade operacional de secrets/callbacks;
- valor futuro de account linking;
- implicações de privacidade/App Store.

Nenhum provider é autorizado a definir o `handle` público do War-Brasil automaticamente. Provider name/avatar MAY inicializar sugestões/fallbacks; `profile.commanders` continua sendo a identidade pública autoritativa do jogo.

## 3. Matriz

| Provider | Launch | Aderência gamer | Better Auth | Email | Observação |
| --- | --- | --- | --- | --- | --- |
| Google | **sim** | média | built-in | normalmente confiável | alcance geral, OIDC maduro, baixo atrito |
| Apple | **sim** | média | built-in | especial | privacidade, web/native; email só é emitido no primeiro consentimento |
| Discord | **sim** | **alta** | built-in | pode faltar | identidade comunitária gamer; phone-only pode não fornecer email |
| Email/senha | **sim** | neutra | core | obrigatório | independência de plataforma e recuperação |
| Passkey | pós-login | neutra | plugin oficial | não depende de email no uso | retorno rápido, WebAuthn, resistente a phishing |
| Microsoft | fase 2 | alta em PC/Xbox | built-in | normalmente disponível, mas não pressupor | conta Microsoft pode estar ligada ao ecossistema Xbox; dados Xbox exigem integração própria |
| Steam | link/futuro | **muito alta** | não é built-in OAuth/OIDC | não fornece no OpenID web | Steam web usa OpenID 2.0; excelente para vincular SteamID e ownership |
| Twitch | fase 2/3 | alta | built-in | usuários sem email podem falhar | útil se streaming/comunidade virar feature real |
| Epic/EOS | futuro específico | alta | integração específica | depende do fluxo | usar se EOS/EGS virar plataforma do produto |
| GitHub | **não** | baixa | built-in | pode faltar/ser privado | identidade de desenvolvedor; não justifica espaço no modal do jogo |

## 4. Google

Google é provider Tier 1.

Contrato:

- usar o provider built-in do Better Auth;
- scopes iniciais: somente identidade básica (`openid`, `email`, `profile` ou equivalente default mínimo);
- `sub`/provider account ID é a identidade externa estável; email não é bearer credential nem chave de autorização;
- Google name/avatar MAY ser usados como sugestão/fallback no onboarding, mas não sobrescrevem `profile.commanders` depois de configurado;
- `GOOGLE_CLIENT_SECRET` é server-only;
- não pedir scopes de Drive/Calendar/Contacts ou outros serviços no login inicial.

Referências:

- https://better-auth.com/docs/authentication/google
- https://developers.google.com/identity/openid-connect/openid-connect

## 5. Apple

Apple é provider Tier 1, apesar de ter configuração operacional mais complexa.

Motivos:

- funciona em browser e possui fluxo nativo para ecossistema Apple;
- melhora a opção de privacidade por permitir relay/private email;
- prepara o produto para eventual app iOS/iPadOS;
- se uma futura app App Store usar login social de terceiros para a conta principal, a política Apple exige uma opção equivalente que limite coleta, permita ocultar email e tenha requisitos de privacidade; Sign in with Apple satisfaz naturalmente esse desenho.

Contrato técnico:

- usar provider built-in do Better Auth;
- configurar Service ID para web;
- armazenar `APPLE_PRIVATE_KEY` exclusivamente server-side;
- `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_CLIENT_ID` permanecem server-side por política do projeto, mesmo não sendo todos segredos;
- gerar o Apple client secret JWT dinamicamente no servidor a partir da private key, em vez de manter um JWT manual de longa duração quando possível;
- respeitar expiração máxima do client secret Apple;
- adicionar apenas `https://appleid.apple.com` à trusted origin necessária ao provider, sem ampliar origins genericamente;
- Apple web não funciona com callback `localhost`/HTTP: testes reais do provider usam HTTPS de preview/túnel dedicado;
- `profile.sub`/provider account ID é a identidade estável; não usar email como provider key.

### Email Apple

Apple pode emitir o email somente no primeiro consentimento e pode fornecer endereço relay privado. Portanto:

- persistir corretamente o email válido recebido na primeira autorização;
- relay Apple é endereço válido/contatável enquanto ativo e MUST NOT ser tratado como placeholder;
- sign-ins posteriores MUST continuar funcionando pela conta externa já vinculada mesmo quando o provider não reenviar email;
- implementação de fallback exigida pela biblioteca não pode sobrescrever silenciosamente um email real previamente persistido.

Referências:

- https://better-auth.com/docs/authentication/apple
- https://developer.apple.com/sign-in-with-apple/usage-guidelines-for-websites-and-other-platforms/
- https://developer.apple.com/app-store/review/guidelines/

## 6. Discord

Discord é provider Tier 1 porque fornece uma identidade altamente coerente com comunidade de jogo e possui suporte built-in no Better Auth.

Contrato:

- scopes iniciais limitados a `identify` + `email` quando necessário ao provider;
- não pedir `guilds`, bot, connections, activities ou scopes comunitários apenas para autenticação;
- `profile.id`/Discord snowflake é provider account ID; username/global name não são chaves estáveis do War-Brasil;
- avatar/global name MAY sugerir dados do onboarding, nunca substituir automaticamente identidade pública já configurada.

### Discord sem email

Contas Discord phone-only podem retornar `email = null` mesmo quando o fluxo solicita email.

Se a versão do Better Auth exigir email para criar `auth.user`, o fallback interno:

- MUST ser derivado do provider account ID, não de username;
- MUST usar domínio reservado `.invalid` ou representação explicitamente não-entregável;
- MUST ser tratado como **non-contact email**;
- MUST NOT receber verification, reset, magic-link ou notificações;
- MUST NOT ser usado para implicit account linking;
- MUST NOT ser mostrado como email do jogador;
- MAY disparar onboarding posterior para coleta de email real caso uma funcionalidade realmente exija canal de email.

A ausência de email Discord não impede, por si só, que uma identidade OAuth válida acesse o jogo, desde que as regras da implementação escolhida consigam representar esse estado com segurança.

Referências:

- https://better-auth.com/docs/authentication/discord
- https://discord.com/developers/docs/topics/oauth2
- https://docs.discord.com/developers/resources/user

## 7. Microsoft / Xbox

Microsoft é Tier 2, não porque seja tecnicamente inferior, mas para evitar quatro providers visuais no launch sem benefício medido.

Razões para manter preparado:

- Better Auth possui provider Microsoft built-in;
- contas Microsoft pessoais incluem identidades usadas em serviços como Xbox;
- Microsoft possui fluxos específicos para websites de títulos Xbox e SSO de jogos.

Limite importante:

**Login Microsoft genérico não equivale a integração Xbox.** Gamertag, gamer picture, XUID, privileges, ownership e Xbox Services exigem APIs/consentimentos/integração de gaming próprios.

Promover Microsoft a Tier 1 quando existir pelo menos um:

- distribuição Windows Store/Game Pass/Xbox;
- integração de Xbox Services;
- telemetria real mostrando demanda significativa;
- necessidade de SSO Microsoft no cliente nativo.

Referências:

- https://better-auth.com/docs/authentication/microsoft
- https://learn.microsoft.com/en-us/entra/identity-platform/howto-modify-supported-accounts
- https://learn.microsoft.com/en-us/xbox/gdk/docs/services/fundamentals/s2s-auth-calls/service-authentication/live-website-authentication

## 8. Steam

Steam é estrategicamente valioso, mas não entra no launch web.

A documentação Steamworks oficial para navegador usa **OpenID 2.0** e retorna SteamID de 64 bits. O Generic OAuth do Better Auth é voltado a OAuth 2.0/OIDC; portanto Steam não deve ser encaixado artificialmente como Generic OAuth.

Primeiro uso recomendado:

```text
War-Brasil account autenticada
        ↓
Link Steam
        ↓
verificar resposta OpenID / ticket de plataforma
        ↓
auth.external_identity(provider='steam', subject=SteamID)
```

Quando houver distribuição Steam, preferir autenticação/ticket Steamworks adequado ao cliente e backend, podendo eliminar um segundo login percebido pelo usuário.

Steam ownership/VAC/profile APIs são autorização de plataforma e MUST permanecer separadas da sessão principal War-Brasil.

Referência:

- https://partner.steamgames.com/doc/features/auth

## 9. Twitch

Twitch permanece Tier 2/3.

Pontos positivos:

- público gamer;
- OAuth/OIDC moderno;
- provider built-in no Better Auth;
- possui device-code flow útil para alguns clientes de jogo.

Contra:

- menor cobertura geral que Google/Apple;
- valor é maior quando o produto possui integração real com streaming/comunidade;
- Better Auth documenta que usuários Twitch sem email não conseguem entrar pelo provider padrão.

Não adicionar no launch apenas para aumentar o número de botões.

Referências:

- https://better-auth.com/docs/authentication/twitch
- https://dev.twitch.tv/docs/authentication

## 10. Epic / EOS

Epic Account Services/EOS é uma integração de plataforma/cross-play, não uma dependência necessária do login web atual.

Só deve entrar quando War-Brasil realmente usar EOS/EGS ou funcionalidades cross-platform que justifiquem:

- Epic account linking;
- external identity providers;
- Connect/Auth interfaces;
- entitlement/platform integration.

Até lá, adicionar Epic ao modal aumentaria complexidade operacional sem produto correspondente.

Referência:

- https://dev.epicgames.com/documentation/en-us/unreal-engine/online-subsystem-eos-plugin-in-unreal-engine

## 11. Passkeys

Passkey não substitui os providers Tier 1 no primeiro contato, mas SHOULD virar o melhor caminho de retorno depois do onboarding.

Fluxo desejado:

```text
primeiro login
Google / Apple / Discord / credentials
        ↓
profile.commanders completo
        ↓
oferecer "Ativar acesso rápido"
        ↓
registrar passkey
        ↓
logins futuros podem usar WebAuthn
```

Regras:

- usar `@better-auth/passkey` quando implementado;
- RP ID/origin versionados e validados;
- nenhuma private key WebAuthn sai do authenticator do usuário;
- passkey não deve ser obrigatória no launch;
- recuperação de conta continua existindo por outro método vinculado.

Referências:

- https://better-auth.com/docs/plugins/passkey
- https://www.w3.org/TR/webauthn-3/

## 12. Account linking

A conta War-Brasil é a entidade principal. Providers são credenciais vinculadas.

Configuração inicial desejada do Better Auth:

```text
accountLinking.enabled = true
accountLinking.disableImplicitLinking = true
accountLinking.allowDifferentEmails = true
accountLinking.trustedProviders = []
accountLinking.updateUserInfoOnLink = false
accountLinking.allowUnlinkingAll = false
```

Motivo:

- Apple pode usar relay email diferente do Google;
- Discord pode não possuir email;
- mesmo email não deve provocar merge silencioso de duas identidades;
- usuário já autenticado pode vincular explicitamente outro provider;
- nenhum provider pode reescrever `displayName`, retrato ou handle do jogo após linking.

O fluxo de login com provider cujo email coincide com conta existente, mas não está vinculado, SHOULD apresentar recuperação/linking explícito em vez de fazer merge silencioso.

Referência:

- https://better-auth.com/docs/concepts/users-accounts

## 13. Provider identity no banco

`auth.account`/estrutura Better Auth continua sendo a fonte primária de contas externas suportadas nativamente.

Integrações fora do protocolo/provider padrão (ex.: SteamID futuro) MAY exigir uma tabela explícita de external identities se não puderem ser representadas corretamente em `auth.account` sem distorcer o contrato da biblioteca.

Nunca usar email como chave cross-provider. A chave externa é conceitualmente:

```text
(provider_id, provider_subject/account_id)
```

A identidade interna continua:

```text
auth.user.id
```

## 14. Provider email ≠ identidade pública

Provider email é dado privado de autenticação/contato.

MUST NOT:

- virar `profile.commanders.handle`;
- ser usado na busca pública;
- aparecer no Lobby/Profile público;
- ser usado como autorização;
- ser assumido como igual entre providers;
- ser usado para merge automático no launch.

A PROFILE pública continua usando `handle`, `displayName`, retrato cosmético/provider fallback e demais contratos definidos em `DATABASE-PLAN.md`.

## 15. Variáveis de ambiente resultantes

### Launch

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

APPLE_CLIENT_ID
APPLE_TEAM_ID
APPLE_KEY_ID
APPLE_PRIVATE_KEY
APPLE_APP_BUNDLE_IDENTIFIER   # somente quando houver fluxo nativo que precise do audience adicional

DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
```

Todas permanecem server-only pela política do War-Brasil. Apenas os secrets/private key são segredos criptográficos, mas IDs também não precisam ser expostos ao client para o fluxo escolhido.

### Fora do launch

Não criar antecipadamente:

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

Variáveis de um provider entram somente no mesmo PR que habilita o provider e seus gates.

## 16. Critério para adicionar novo provider

Novo provider só entra se houver:

1. caso de produto/audiência explícito;
2. protocolo e integração revisados;
3. identificador externo estável documentado;
4. tratamento de email ausente/privado documentado;
5. account-linking definido;
6. env/secrets classificados;
7. staging test real do callback;
8. EVAL atualizado;
9. UI que não vire uma parede de botões.

A quantidade de providers não é métrica de qualidade da autenticação.
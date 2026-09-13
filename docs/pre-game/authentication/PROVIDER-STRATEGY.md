# Estratégia de Providers — Authentication / War-Brasil

**Branch:** `feature/auth-command-access`  
**Relaciona:** `SPEC.md`, `EVAL.md`, `DATABASE-PLAN.md`.  
**Escopo normativo:** somente Google, Apple, Discord e email + senha.

## 1. Decisão final de launch

O War-Brasil terá exatamente quatro métodos de entrada na primeira versão:

| Método | Papel | Launch |
| --- | --- | --- |
| **Google** | identidade generalista | **sim** |
| **Apple** | privacidade + mobile/iOS | **sim** |
| **Discord** | identidade social gamer | **sim** |
| **Email + senha** | fallback independente | **sim** |

Nenhum outro provider faz parte deste escopo. GitHub, Microsoft, Steam, Twitch, Epic, passkeys e demais métodos MUST NOT aparecer no modal, config, env, banco custom ou testes desta implementação.

Adicionar um quinto método exige mudança explícita de `PROVIDER-STRATEGY.md`, `SPEC.md` e `EVAL.md`.

## 2. Princípios comuns

A conta War-Brasil é a identidade principal. Google, Apple, Discord e credentials são formas de autenticar essa conta.

MUST:

- usar `auth.user.id` como identidade interna;
- usar provider account ID/subject como identidade externa estável;
- nunca usar email como bearer credential ou autorização;
- nunca transformar email do provider em `profile.commanders.handle`;
- nunca expor provider token no client;
- manter `profile.commanders` como identidade pública autoritativa do jogo;
- usar nome/avatar do provider somente como sugestão ou fallback de onboarding;
- fazer account linking de forma explícita, não por coincidência silenciosa de email.

Configuração desejada de linking:

```text
accountLinking.enabled = true
accountLinking.disableImplicitLinking = true
accountLinking.allowDifferentEmails = true
accountLinking.trustedProviders = []
accountLinking.updateUserInfoOnLink = false
accountLinking.allowUnlinkingAll = false
```

Motivos:

- Apple pode fornecer relay diferente do email usado no Google;
- Discord pode não fornecer email;
- mesmo email em dois providers não prova que duas credenciais devem ser unidas automaticamente;
- provider vinculado não pode sobrescrever handle, loadout ou identidade pública já configurados.

## 3. Google

Google é o provider generalista do launch.

Contrato:

- usar provider Google built-in do Better Auth;
- scopes mínimos de identidade (`openid`, `email`, `profile` ou defaults equivalentes);
- `sub`/provider account ID é a chave externa estável;
- nome/avatar podem inicializar sugestão de perfil;
- não solicitar Drive, Calendar, Contacts ou outros scopes no login;
- `GOOGLE_CLIENT_SECRET` permanece server-only.

## 4. Apple

Apple é provider de launch para privacidade e compatibilidade futura com iOS/iPadOS.

Contrato:

- usar provider Apple suportado pelo Better Auth;
- Service ID para fluxo web;
- `APPLE_PRIVATE_KEY` exclusivamente server-side;
- `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_CLIENT_ID` permanecem server-side pela política do projeto;
- gerar client secret JWT no servidor quando a integração exigir;
- callback real deve usar HTTPS; testes do provider não dependem de localhost HTTP;
- provider subject (`sub`) é a identidade externa, não o email.

### 4.1 Email Apple

Apple pode fornecer email somente no primeiro consentimento e pode usar relay privado.

MUST:

- preservar o email válido/relay recebido na primeira autorização;
- tratar relay Apple como email real enquanto ativo, não placeholder;
- permitir logins posteriores quando Apple não reenviar email;
- nunca substituir email Apple persistido por fallback sintético;
- nunca usar diferença entre relay e email Google para bloquear linking explícito.

## 5. Discord

Discord é o provider social gamer do launch.

Contrato:

- scopes somente `identify` + `email` quando necessário;
- não pedir `guilds`, bot, connections, activities ou scopes não necessários ao login;
- Discord user ID/snowflake é a identidade externa estável;
- username/global name/avatar são dados apresentacionais e podem mudar;
- identidade pública do jogo continua em `profile.commanders`.

### 5.1 Discord sem email

Contas phone-only podem não fornecer email.

Se a versão fixada do Better Auth exigir uma string de email para `auth.user`, qualquer representação sintética MUST:

- ser derivada do Discord user ID;
- usar domínio reservado `.invalid`;
- ser marcada/tratada como não-entregável;
- nunca receber verification, password reset ou comunicação;
- nunca aparecer na PROFILE;
- nunca participar de linking implícito.

A implementação SHOULD preferir o mecanismo oficial mais recente do Better Auth para providers sem email, caso exista na versão fixada, em vez de criar workaround desnecessário.

## 6. Email + senha

Email + senha é o método independente de provider e segue a experiência do Contrapista para verificação de cadastro.

### 6.1 Fluxo obrigatório

```text
CADASTRO EMAIL + SENHA
        ↓
validar dados + termos
        ↓
Better Auth cria conta credentials não verificada
        ↓
enviar email de verificação
        ↓
modal mostra "Confira seu email"
        ↓
NENHUMA sessão / NENHUM command-open
        ↓
usuário abre link de verificação
        ↓
Better Auth valida token e marca email verificado
        ↓
redirect para Home com resultado de verificação
        ↓
usuário faz login normalmente
        ↓
profile completo?
  ├─ não -> onboarding
  └─ sim -> command-open
```

A experiência é equivalente ao Contrapista, mas a implementação usa o mecanismo nativo do Better Auth. War-Brasil MUST NOT copiar a tabela custom `email_verification_tokens` nem persistir password hash em uma segunda tabela de pendência.

### 6.2 Configuração Better Auth desejada

A versão fixada deve suportar comportamento equivalente a:

```ts
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
  autoSignIn: false,
}

emailVerification: {
  sendOnSignUp: true,
  sendOnSignIn: false,
  autoSignInAfterVerification: false,
  expiresIn: 60 * 60,
  sendVerificationEmail: sendWarBrasilVerificationEmail,
}
```

Os nomes/opções exatos MUST ser confirmados contra a versão pinada do Better Auth antes do código final.

Normas:

- link válido por **1 hora**;
- cadastro não abre sessão;
- clique no link não abre sessão automaticamente;
- login credentials de email não verificado não pode produzir sessão;
- após cadastro bem-sucedido, senha sai do estado do formulário;
- UI permanece em estado `verification-pending` com email mascarado quando útil;
- botão de reenvio é explícito e rate-limited;
- reenvio responde de forma não-enumerável;
- callback final retorna à Home e informa `success`, `invalid` ou `expired` sem incluir token na UI/log.

### 6.3 Diferença interna em relação ao Contrapista

Contrapista armazena cadastro pendente (incluindo password hash) em uma tabela própria e só cria o usuário após a confirmação. War-Brasil não repetirá isso.

Com Better Auth:

- `auth.user`/credentials podem existir antes da confirmação;
- `emailVerified = false` é o estado de pendência;
- Better Auth possui a fonte de verdade do token/verificação;
- `requireEmailVerification` impede criação de sessão antes da confirmação;
- nenhum schema paralelo de verification será criado pelo código do War-Brasil.

O efeito de produto permanece o mesmo: conta não verificada não entra no jogo.

## 7. Email transacional

O Contrapista entrega emails via Gmail API. War-Brasil preserva o fluxo, mas não acopla auth ao Gmail.

Criar uma boundary server-only conceitual:

```ts
sendAuthEmail({
  to,
  subject,
  text,
  html,
})
```

`sendVerificationEmail` do Better Auth chama essa boundary.

O transportador (Resend/SES/SMTP/Gmail ou equivalente) pode ser decidido separadamente sem alterar o fluxo de autenticação.

MUST:

- usar remetente configurado server-side;
- manter credential do transportador fora do browser;
- possuir versão HTML e texto simples;
- não logar URL/token de verificação;
- usar URL fornecida pelo Better Auth, não construir token custom;
- em infraestrutura serverless, usar mecanismo seguro de background/wait-until quando necessário para evitar timing leak sem cancelar o envio.

### 7.1 Conteúdo mínimo do email

O email War-Brasil deve manter o padrão de experiência do Contrapista, adaptado visualmente:

- marca War-Brasil;
- nome/display name quando disponível;
- texto curto explicando que falta confirmar o email;
- CTA `VERIFICAR EMAIL`;
- link textual de fallback;
- aviso `Link válido por 1 hora`;
- aviso para ignorar se o cadastro não foi solicitado;
- versão responsiva e compatível com dark mode quando possível.

## 8. Reenvio

O estado `verification-pending` MUST oferecer reenvio após cooldown visual.

Servidor MUST:

- aplicar rate limit;
- retornar resposta genérica independentemente de existir conta;
- não revelar `emailVerified` de terceiros;
- usar API oficial do Better Auth para disparar novo link;
- não criar tabela/token paralelo;
- não enviar para emails sintéticos `.invalid` de Discord.

A UI SHOULD informar somente algo equivalente a:

> Se existir uma conta pendente para esse endereço, enviaremos um novo link de verificação.

## 9. Provider social e email verification

A exigência de verificação descrita na seção 6 é obrigatória para **email + senha**.

Para Google/Apple/Discord:

- usar o sinal de email verificado do provider somente quando a versão/documentação do provider o considera confiável;
- não forçar o fluxo credentials de verification sobre um OAuth válido sem necessidade;
- provider account ID continua sendo a prova de identidade externa;
- Discord sem email usa o tratamento específico da seção 5.1;
- nenhuma regra social pode transformar email em identidade pública.

## 10. Variáveis de ambiente

### Providers do launch

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

APPLE_CLIENT_ID
APPLE_TEAM_ID
APPLE_KEY_ID
APPLE_PRIVATE_KEY
# APPLE_APP_BUNDLE_IDENTIFIER apenas se um cliente Apple nativo realmente for implementado

DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
```

### Email transacional

```text
AUTH_EMAIL_FROM
<EMAIL_TRANSPORT_SECRET>
# ou SMTP_URL quando SMTP for a estratégia escolhida
```

Todos são server-only por política do projeto. Nenhuma variável específica de auth usa `NEXT_PUBLIC_`.

Não criar variáveis para providers fora deste documento.

## 11. Definition of Done

O modal de launch oferece somente Google, Apple, Discord e Email + senha. Credentials exige verificação por link de 1 hora antes de qualquer sessão, seguindo a experiência do Contrapista. OAuth não usa email como chave de autorização. O fluxo de email é provido pelo Better Auth através de uma boundary server-only de entrega, sem tabela/token custom paralelo e sem segredos no client.

# Estratégia de Providers — Authentication / War-Brasil

**Branch:** `feature/auth-command-access`  
**Relaciona:** `SPEC.md`, `EVAL.md`, `DATABASE-PLAN.md`.  
**Escopo normativo:** somente Google, Discord e email + senha.

## 1. Decisão final de launch

O War-Brasil terá exatamente três métodos de entrada na primeira versão:

| Método | Papel | Launch |
| --- | --- | --- |
| **Google** | identidade generalista | **sim** |
| **Discord** | identidade social gamer | **sim** |
| **Email + senha** | fallback independente | **sim** |

Apple não faz parte desta implementação. Nenhum outro provider faz parte deste escopo. Apple, GitHub, Microsoft, Steam, Twitch, Epic, passkeys e demais métodos MUST NOT aparecer no modal, config, env, código de provider ou testes positivos desta implementação.

Adicionar um quarto método exige mudança explícita de `PROVIDER-STRATEGY.md`, `SPEC.md` e `EVAL.md`.

## 2. Princípios comuns

A conta War-Brasil é a identidade principal. Google, Discord e credentials são formas de autenticar essa conta.

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

- Discord pode não fornecer email;
- providers podem fornecer emails diferentes para a mesma pessoa;
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

## 4. Discord

Discord é o provider social gamer do launch.

Contrato:

- scopes somente `identify` + `email` quando necessário;
- não pedir `guilds`, bot, connections, activities ou scopes não necessários ao login;
- Discord user ID/snowflake é a identidade externa estável;
- username/global name/avatar são dados apresentacionais e podem mudar;
- identidade pública do jogo continua em `profile.commanders`.

### 4.1 Discord sem email

Contas phone-only podem não fornecer email.

Se a versão fixada do Better Auth exigir uma string de email para `auth.user`, qualquer representação sintética MUST:

- ser derivada do Discord user ID;
- usar domínio reservado `.invalid`;
- ser marcada/tratada como não-entregável;
- nunca receber verification, password reset ou comunicação;
- nunca aparecer na PROFILE;
- nunca participar de linking implícito.

A implementação SHOULD preferir o mecanismo oficial mais recente do Better Auth para providers sem email, caso exista na versão fixada, em vez de criar workaround desnecessário.

## 5. Email + senha

Email + senha é o método independente de provider e segue a experiência do Contrapista para verificação de cadastro.

### 5.1 Fluxo obrigatório

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

### 5.2 Configuração Better Auth desejada

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

Normas:

- link válido por **1 hora**;
- cadastro não abre sessão;
- clique no link não abre sessão automaticamente;
- login credentials de email não verificado não pode produzir sessão;
- após cadastro bem-sucedido, senha sai do estado do formulário;
- UI permanece em estado `verification-pending`;
- botão de reenvio é explícito e rate-limited;
- reenvio responde de forma não-enumerável;
- callback final retorna à Home sem incluir token na UI/log.

## 6. Email transacional

A autenticação não fica acoplada ao fornecedor de email.

Boundary server-only:

```ts
sendAuthEmail({
  to,
  subject,
  text,
  html,
})
```

`sendVerificationEmail` e password reset do Better Auth chamam essa boundary.

O transportador (Resend/SES/SMTP/Gmail ou equivalente) pode ser decidido separadamente sem alterar o fluxo de autenticação.

## 7. Provider removido: Apple

Apple está explicitamente fora do launch atual.

MUST NOT existir nesta implementação:

- provider Apple no Better Auth;
- botão `Continuar com Apple`;
- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` ou configuração equivalente;
- geração de Apple client secret/JWT;
- callback `/api/auth/callback/apple` como fluxo suportado;
- teste positivo ou requisito de staging Apple.

A inclusão futura de Apple é uma mudança de escopo e exige novo SPEC/EVAL antes de qualquer código.
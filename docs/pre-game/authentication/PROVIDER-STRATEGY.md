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

Email + senha é o método credentials independente de provider.

### 5.1 Fluxo obrigatório

```text
CADASTRO EMAIL + SENHA
        ↓
validar dados + termos
        ↓
auth.pending_registration
        ↓
OTP de 6 dígitos
        ↓
NENHUM auth.user / NENHUMA sessão
        ↓
usuário confirma OTP
        ↓
auth.user(emailVerified=true)
+ auth.account(credential)
        ↓
pending removido
        ↓
sessão Better Auth
        ↓
profile completo?
  ├─ não -> onboarding
  └─ sim -> command-open
```

O signup credentials nativo do Better Auth fica desabilitado. Better Auth continua responsável pela autenticação permanente, hash compatível, sessões e password reset depois que a identidade é promovida.

### 5.2 Contrato

```ts
emailAndPassword: {
  enabled: true,
  disableSignUp: true,
  requireEmailVerification: true,
  autoSignIn: false,
}
```

Normas:

- antes do OTP existe somente `auth.pending_registration`;
- senha temporária fica criptografada;
- OTP fica apenas como HMAC;
- código possui 6 dígitos e expira em 10 minutos;
- máximo de 5 tentativas;
- reenvio tem cooldown de 60 segundos;
- confirmação promove a conta em transação;
- `auth.user` já nasce com `emailVerified=true`;
- confirmação estabelece a sessão e abre onboarding;
- resposta de cadastro/reenvio é não-enumerável.

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

O envio do OTP de cadastro e o password reset chamam essa boundary. O primeiro é do fluxo `pending_registration`; o segundo continua vindo do Better Auth.

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
# Fluxo de Confirmação de Email — Credentials

**Escopo:** cadastro Email + senha, OTP, promoção para conta Better Auth, reenvio e onboarding.  
**Fonte de verdade:** implementação em `src/lib/server/auth/pending-registration.ts` e rotas `/api/auth/register/*`.

## 1. Princípio

No War-Brasil, uma linha em `auth.user` representa uma conta real.

Portanto, **cadastro ainda não confirmado não cria `auth.user` nem `auth.account`**.

Antes da confirmação existe somente:

```text
auth.pending_registration
```

Essa linha é temporária e descartável.

Depois da confirmação:

- o cadastro pendente é promovido para `auth.user`;
- a credential é criada em `auth.account`;
- `emailVerified=true` já nasce verdadeiro;
- a linha temporária é removida;
- Better Auth cria a sessão;
- o usuário segue para o onboarding de `profile.commanders`.

## 2. Fluxo normativo

```text
email + senha + confirmar senha + termos
            ↓
POST /api/auth/register
            ↓
auth.pending_registration
            ↓
OTP de 6 dígitos por email
            ↓
verification-pending
            ↓
POST /api/auth/register/verify
            ↓
OTP válido?
  ├─ não → permanece pendente
  └─ sim
       ↓
   auth.user (emailVerified=true)
       +
   auth.account (credential)
       ↓
   pending_registration removido
       ↓
   sessão Better Auth
       ↓
   onboarding nome + @handle
       ↓
   profile.commanders + economy state
       ↓
   command-open
```

## 3. Dados temporários

`auth.pending_registration` contém somente o necessário para concluir o cadastro:

- email normalizado;
- senha temporária criptografada com AES-256-GCM;
- HMAC-SHA256 do OTP;
- contador de tentativas;
- aceite dos termos;
- expiração do OTP;
- cooldown de reenvio;
- timestamps.

A tabela **não contém**:

- senha em texto puro;
- OTP em texto puro;
- sessão;
- profile;
- wallet/loadout;
- handle.

A senha temporária existe apenas para permitir a criação da credential e a abertura da sessão depois que o usuário provar posse do email. Após a promoção, a linha inteira é removida.

## 4. OTP

Contrato atual:

```text
tamanho:       6 dígitos
validade:      10 minutos
tentativas:    máximo 5
reenvio:       cooldown de 60 segundos
```

O código bruto é enviado por email, mas nunca persistido. O banco recebe somente um HMAC usando segredo server-only.

Código incorreto incrementa `attempts`. Ao atingir o limite, é obrigatório solicitar novo código.

Reenvio:

- gera um novo OTP;
- invalida o anterior;
- zera tentativas;
- renova expiração;
- preserva resposta pública não-enumerável.

## 5. Cadastro

`POST /api/auth/register` valida:

- email;
- senha de 8–128 caracteres;
- aceite legal;
- Origin first-party.

O endpoint não chama `/sign-up/email`.

O Better Auth está configurado com:

```ts
emailAndPassword: {
  enabled: true,
  disableSignUp: true,
  requireEmailVerification: true,
  autoSignIn: false,
}
```

`disableSignUp=true` impede que o endpoint credentials nativo seja usado como caminho alternativo para criar usuário antes do OTP.

## 6. Confirmação

`POST /api/auth/register/verify` recebe:

```json
{
  "email": "usuario@example.com",
  "code": "482913"
}
```

Para OTP válido, uma transação PostgreSQL:

1. bloqueia a linha pendente;
2. valida expiração/tentativas/HMAC;
3. confirma que não surgiu uma conta existente;
4. descriptografa a senha temporária apenas em memória;
5. calcula o hash compatível com Better Auth;
6. cria `auth.user` já com `emailVerified=true`;
7. cria `auth.account` com `providerId='credential'`;
8. remove `auth.pending_registration`;
9. commit.

Depois do commit, `auth.api.signInEmail()` cria a sessão e os cookies Better Auth.

A falha de criação da sessão não desfaz uma conta confirmada; nesse caso o usuário ainda pode entrar normalmente com email e senha.

## 7. Estado da UI

Depois do signup:

```text
CONFIRME SEU EMAIL

Enviamos um código para lu***@example.com.

[ 000000 ]

[ CONFIRMAR EMAIL ]

Novo código em 42 s
```

A UI:

- usa `autocomplete="one-time-code"`;
- mascara o email;
- não mantém senha;
- não coloca OTP na URL;
- informa validade de 10 minutos;
- oferece reenvio após cooldown.

OTP confirmado chama `onAuthenticated()`, e o Home consulta `/api/auth/command-access`.

Como ainda não existe `profile.commanders`, o resultado abre `CommandOnboardingModal`.

## 8. Onboarding

Depois da confirmação:

```text
sessão Better Auth
      ↓
CommandOnboardingModal
      ↓
displayName + @handle
      ↓
PUT /api/auth/command-access
      ↓
profile.commanders
      ↓
ensureEconomyState()
      ↓
command-open
```

O email nunca é usado como handle.

## 9. Reenvio

`POST /api/auth/register/resend`:

- exige Origin first-party;
- só opera sobre cadastro pendente;
- respeita `resend_available_at`;
- troca o HMAC/OTP atual;
- retorna resposta genérica.

Resposta pública:

```text
Se existir um cadastro pendente para esse endereço, enviaremos um novo código.
```

## 10. Email

O transporte permanece server-only e usa Resend através de `sendAuthEmail()`.

O email contém:

- branding WAR Brasil;
- OTP de 6 dígitos;
- validade de 10 minutos;
- aviso para ignorar cadastro não solicitado;
- HTML + texto simples.

Não contém link de confirmação.

Password reset continua sendo um fluxo separado e continua usando o mecanismo/token do Better Auth.

## 11. OAuth

Google e Discord não usam `pending_registration`.

```text
Google / Discord
       ↓
provider comprova identidade
       ↓
Better Auth
       ↓
sessão
       ↓
onboarding caso profile incompleto
```

## 12. Segurança e enumeração

MUST:

- nunca armazenar senha ou OTP temporário em texto puro;
- nunca logar OTP;
- nunca retornar password hash/ciphertext;
- impedir signup credentials nativo;
- usar transação para promoção pendente → conta;
- impedir replay removendo a linha pendente;
- manter respostas de cadastro/reenvio não-enumeráveis;
- rejeitar mutation com Origin não confiável;
- não enviar email para domínios `.invalid`.

## 13. Limpeza

Cadastros pendentes antigos são descartáveis.

O serviço remove oportunisticamente registros com mais de 24 horas, enquanto o OTP individual expira em 10 minutos.

## 14. Definition of Done

O fluxo credentials está correto quando:

1. signup válido cria somente `auth.pending_registration`;
2. antes do OTP não existe `auth.user`;
3. email contém OTP de 6 dígitos;
4. OTP inválido/expirado não cria conta;
5. OTP válido cria `auth.user + auth.account` já verificados;
6. a linha pendente é removida;
7. a confirmação cria uma sessão Better Auth;
8. a Home abre imediatamente o onboarding de nome/@handle;
9. o onboarding cria `profile.commanders` e o estado econômico;
10. replay do OTP não produz nova ação privilegiada.

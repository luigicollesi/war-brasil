# Fluxo de Verificação de Email — Credentials

**Escopo:** cadastro, envio, pendência, confirmação, reenvio e login de Email + senha.  
**Referências normativas:** `SPEC.md`, `EVAL.md`, `PROVIDER-STRATEGY.md`.

## 1. Objetivo

Reproduzir a experiência do Contrapista sem copiar sua implementação custom de token/tabela.

No War-Brasil:

- Better Auth cria e mantém o credentials user;
- Better Auth mantém o estado `emailVerified` e verification token;
- o War-Brasil fornece apenas a boundary de entrega do email e a UX;
- conta credentials não verificada nunca recebe sessão/Command Access.

## 2. Estado de produto

```text
register-form
   ↓ submit válido
creating-account
   ↓
verification-pending
   │
   ├── resend -> verification-pending
   ├── back-to-login -> login-form
   └── link aberto fora/dentro da página
                ↓
        verified | invalid
                ↓
              Home
```

`verified` não significa `authenticated`.

Após `verified`, o usuário faz login normalmente.

## 3. Signup

Entrada mínima:

```text
email
password
termsAccepted
```

Handle/display name pertencem ao onboarding comum de perfil e não precisam ser reservados antes da posse do email ser confirmada.

Isso reduz:

- reserva abusiva de handles por emails não verificados;
- divergência entre credentials e OAuth;
- duplicação de lógica de onboarding.

### 3.1 Segurança contra enumeração

O fluxo público MUST NOT depender de resposta `email já cadastrado`.

Com `requireEmailVerification=true`, usar o comportamento de proteção a enumeração disponível na versão Better Auth fixada.

Para signup com email existente, a resposta pública SHOULD permanecer compatível com uma resposta genérica de sucesso/pêndencia, sem revelar se:

- o email não existe;
- existe e está pendente;
- existe e já está verificado.

O servidor não cria conta duplicada.

Erros de formato de email, política de senha e aceite legal podem continuar sendo específicos porque não revelam existência de conta.

## 4. Configuração normativa

Comportamento equivalente esperado:

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
  expiresIn: 3600,
  sendVerificationEmail: sendWarBrasilVerificationEmail,
}
```

A versão exata da API deve ser validada na versão pinada do Better Auth.

## 5. Email

Boundary:

```ts
sendWarBrasilVerificationEmail({ user, url })
  -> sendAuthEmail({ to, subject, text, html })
```

O War-Brasil usa `url` entregue pelo Better Auth. Não monta token próprio.

Conteúdo:

```text
WAR-BRASIL
VERIFICAÇÃO DE EMAIL

Confirme seu email para liberar sua identidade de Comando.

[ VERIFICAR EMAIL ]

Se o botão não funcionar, copie o link abaixo.

Link válido por 1 hora.
Se você não criou essa conta, ignore esta mensagem.
```

A versão final deve seguir a identidade visual verde/vermelho/dourado sem sacrificar compatibilidade de clientes de email.

## 6. Entrega assíncrona e timing

`sendVerificationEmail` não deve introduzir diferença temporal desnecessária que ajude enumeração.

Quando a plataforma for serverless:

- usar mecanismo de `waitUntil`/background suportado quando necessário;
- garantir que o envio não seja cancelado após a resposta;
- falha interna de provider não expõe API key, stack ou detalhe operacional ao client.

## 7. `verification-pending`

A UI mostra:

- título `CONFIRME SEU EMAIL`;
- confirmação de que um link foi enviado;
- validade de uma hora;
- botão `REENVIAR EMAIL`;
- botão/link `VOLTAR PARA ENTRAR`;
- email mascarado quando exibido fora do input original;
- nenhuma senha preenchida.

A UI não mostra:

- token;
- user ID interno;
- status bruto `emailVerified` de outros usuários;
- detalhes do provider de email.

## 8. Reenvio

Reenvio usa `authClient.sendVerificationEmail`/API equivalente da versão pinada.

MUST:

- rate limit server-side;
- cooldown visual;
- resposta pública genérica;
- callback interno allowlisted;
- não mandar email para `.invalid`;
- não criar token/tabela paralela.

Resposta recomendada:

```text
Se existir uma conta pendente para esse endereço, enviaremos um novo link.
```

## 9. Clique no link

Link válido:

1. Better Auth valida token;
2. marca email como verificado;
3. executa somente side-effects idempotentes aprovados;
4. **não cria sessão**;
5. redireciona para `/`/callback interno;
6. Home mostra confirmação curta;
7. usuário pode abrir o modal em modo login.

Link inválido, expirado ou reutilizado:

- não verifica conta;
- não cria sessão;
- retorna à Home com estado de erro genérico/recuperável;
- oferece reenviar a partir do fluxo de login/pending quando apropriado.

Não é obrigatório distinguir publicamente `expired` de `invalid`; a UX pode usar `LINK INVÁLIDO OU EXPIRADO`.

## 10. Provisionamento e onboarding

Credentials user não verificado não deve gerar recursos de domínio desnecessários.

O provisionamento completo de `profile.commanders`, wallets/loadout e acesso ao Comando SHOULD ocorrer somente depois que existir identidade autenticável/verificada e o usuário entrar no pipeline de onboarding.

OAuth continua usando o mesmo onboarding comum.

Isso evita criar wallet/profile completos para spam de cadastros nunca verificados.

## 11. Login antes da verificação

Quando email e senha estiverem corretos, mas `emailVerified=false`:

- Better Auth rejeita criação de sessão;
- UI pode encaminhar para `verification-pending`;
- UI oferece reenvio;
- nenhuma rota protegida é liberada.

Uma tentativa com senha errada não deve fornecer detalhe que ajude a distinguir conta existente.

## 12. Fluxo após verificação

```text
email verificado
    ↓
login email + senha
    ↓
sessão válida
    ↓
profile.commanders completo?
  ├─ não -> onboarding
  └─ sim -> command-open
```

A confirmação de email não reserva handle antecipadamente.

## 13. Transportador de email

O Contrapista usa Gmail API, mas o War-Brasil não acopla o contrato a Gmail.

`sendAuthEmail()` pode receber implementação com Gmail, Resend, SES, SMTP ou outro transportador transacional, desde que passe os mesmos EVALs.

Configuração do transportador é server-only:

```text
AUTH_EMAIL_FROM
<EMAIL_TRANSPORT_SECRET>
# SMTP_URL somente se SMTP for escolhido
```

Nenhuma credential de email usa `NEXT_PUBLIC_`.

## 14. Definition of Done

Cadastrar Email + senha sempre termina em `verification-pending`, nunca em sessão. O email contém link Better Auth válido por uma hora. Clicar confirma o email, mas não faz auto-login. Login posterior autentica e segue para onboarding/Comando. Duplicate signup e resend não enumeram contas, e nenhum token/password hash custom é persistido fora das estruturas oficiais do Better Auth.

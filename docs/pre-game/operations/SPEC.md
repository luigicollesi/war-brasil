# SPEC — Operações

**Rota:** `/matchmaking`  
**Cena:** `operations`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

## Fantasia

A Mesa deixa de ser símbolo e torna-se máquina. Matchmaking significa **autorizar uma nova operação** ou **localizar uma operação existente**.

As duas ações MUST parecer modos da mesma estação de comando, não dois cards independentes.

## Contratos funcionais preservados

O redesign MUST reutilizar o comportamento de `CreateRoomButton` e `JoinRoomForm` ou seus contratos equivalentes.

MUST NOT alterar silenciosamente:

- endpoint/semântica de criação;
- formato/normalização do código;
- mensagens/condições de erro relevantes;
- destino após sucesso;
- idempotência/proteção contra submissão duplicada;
- qualquer contrato realtime/banco.

Mudanças funcionais exigem spec próprio.

## Modos

### Nova Operação

Cria uma nova sala. A Mesa MAY destravar, alinhar mecanismos e gerar uma placa/selo de operação, mas a animação MUST NOT atrasar o redirect funcional.

Durante criação:

- desabilitar submissão duplicada quando necessário;
- informar estado assíncrono em texto;
- fornecer recuperação em erro;
- continuar funcional sem 3D.

### Localizar Operação

Recebe o código de sala existente.

O campo MUST ser um controle semanticamente correto, com label/nome acessível, teclado normal, paste e seleção de texto.

A apresentação MAY segmentar caracteres visualmente como cifrador, mas SHOULD preferir um único input real em vez de múltiplos inputs que prejudiquem colagem, seleção, autofill ou leitores de tela.

Normalização/validação MUST seguir o comportamento existente, não a estética nova.

## Composição

- Mesa em estado operacional;
- Brasil MAY separar placas levemente sem perder geografia/fronteiras;
- Coroa Orbital MAY alinhar parcialmente;
- vermelho aparece como sinal de operação, erro ou conflito, não preenchimento decorativo constante;
- create/join compartilham arquitetura visual e mudam o estado da mesma máquina.

Foco de um modo SHOULD alterar a cena de forma contida, sem causar layout shift no formulário.

## Estados

- `idle`
- `create-focus`
- `creating`
- `create-error`
- `join-focus`
- `typing-code`
- `joining`
- `invalid-code`
- `network-error`
- `success-transition`
- `reduced-motion`
- `scene-fallback`

Todo estado assíncrono MUST possuir feedback textual. Motion/3D nunca substituem status.

## Erros e recuperação

Erro MUST:

- explicar que a operação não foi concluída;
- preservar o código digitado quando isso não criar risco funcional;
- liberar retry;
- não deixar loading eterno;
- não depender apenas de vermelho.

## Mobile

MUST:

- manter input e CTAs acessíveis por touch;
- aceitar paste de código completo;
- não abrir teclado inadequado sem necessidade;
- evitar dois painéis comprimidos lado a lado;
- não exigir foco/hover na cena para escolher modo.

Create/Join MAY virar seleção vertical/alternada, desde que continuem claramente dois modos da mesma máquina.

## Não fazer

MUST NOT:

- mudar API/protocolo para facilitar o visual;
- esconder erros na cena 3D;
- usar animação longa antes do redirect;
- bloquear criação/join por asset 3D;
- criar seis inputs apenas por estética;
- transformar os modos em cards SaaS genéricos;
- duplicar lógica de validação apenas na camada visual.

## Definition of Done

Create/Join preservam exatamente o contrato funcional vigente; a página parece uma estação de autorização, funciona com teclado/touch/fallback e passa `EVAL.md`.

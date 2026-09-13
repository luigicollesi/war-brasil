# SPEC — Operações

**Rota:** `/matchmaking`  
**Cena:** `operations`

Segue `../quality-standard.md`, `../visual-language.md` e `../traceability.md`.

## Fantasia

A Central de Operações apresenta primeiro **como o comandante quer entrar no conflito**.

Existem dois protocolos de jogo:

1. **Jogo Clássico** — pareamento automático futuro, visível porém indisponível nesta fase;
2. **Sala Personalizada** — protocolo operacional atual, com criação de sala ou entrada por código.

A interface MUST parecer uma única estação de comando, não um conjunto de cards SaaS independentes.

## Hierarquia funcional

```text
Matchmaking
├── Jogo Clássico
│   └── Encontrar partida [disabled / em breve]
└── Sala Personalizada
    ├── Criar sala
    └── Entrar em sala
```

### Jogo Clássico

Nesta fase é somente apresentação visual.

MUST:

- permanecer visível como opção futura;
- comunicar claramente `Em breve` / `Indisponível`;
- manter o CTA de encontrar partida desabilitado;
- não disparar request, navegação, mutação ou efeito colateral.

MUST NOT implementar matchmaking automático implicitamente dentro desta entrega.

### Sala Personalizada

É o sistema funcional vigente.

MUST reutilizar o comportamento de `CreateRoomButton` e `JoinRoomForm` ou seus contratos equivalentes.

MUST NOT alterar silenciosamente:

- endpoint/semântica de criação;
- formato/normalização do código;
- mensagens/condições de erro relevantes;
- destino após sucesso;
- idempotência/proteção contra submissão duplicada;
- qualquer contrato realtime/banco.

Mudanças funcionais exigem spec próprio.

## Criar sala

Cria uma nova sala e segue para o lobby.

Durante criação:

- desabilitar submissão duplicada quando necessário;
- informar estado assíncrono em texto;
- fornecer recuperação em erro;
- continuar funcional sem 3D;
- animação visual MUST NOT atrasar o redirect funcional.

## Entrar em sala

Recebe o código de sala existente.

O campo MUST ser um controle semanticamente correto, com label/nome acessível, teclado normal, paste e seleção de texto.

A apresentação MAY estilizar o código como cifrador, mas SHOULD manter um único input real em vez de múltiplos inputs.

Normalização/validação MUST seguir o comportamento existente.

## Composição e viewport

A rota MUST funcionar como uma cena full-viewport direta, sem exigir scroll no estado normal.

MUST:

- usar o espaço disponível do viewport como orçamento de layout;
- manter ações principais, input e status dentro da área visível;
- reduzir espaçamentos e conteúdo secundário em alturas menores antes de comprimir controles;
- evitar layout shift ao alternar `Criar sala` / `Entrar em sala`;
- manter `Jogo Clássico` e `Sala Personalizada` perceptíveis na mesma cena;
- preservar Brasil/Mesa/Coroa da Foundation como fundo persistente.

O conteúdo MAY compactar progressivamente em telas baixas, inclusive escondendo descrições secundárias, desde que informação funcional, erros e CTAs continuem acessíveis.

## Motion

A entrada da rota SHOULD continuar a transição visual da Foundation e ser mais suave que uma troca brusca de página.

SHOULD usar prioritariamente `opacity` e `transform`.

MUST:

- respeitar `prefers-reduced-motion`;
- não usar animação longa antes de redirect;
- não bloquear create/join por asset 3D ou animação;
- evitar animação que altere medidas do layout durante entrada.

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
- não exigir hover para escolher ação;
- compactar a cena por altura quando o teclado reduzir o viewport;
- priorizar controles funcionais sobre textos decorativos.

## Não fazer

MUST NOT:

- mudar API/protocolo para facilitar o visual;
- implementar matchmaking clássico nesta entrega;
- esconder erros na cena 3D;
- usar animação longa antes do redirect;
- bloquear criação/join por asset 3D;
- criar seis inputs apenas por estética;
- transformar os protocolos em cards SaaS genéricos;
- duplicar lógica de validação apenas na camada visual.

## Definition of Done

- Jogo Clássico aparece com CTA realmente desabilitado e sem efeito colateral;
- Sala Personalizada preserva exatamente os contratos funcionais vigentes;
- a rota cabe no viewport normal sem scroll;
- create/join funcionam com teclado, touch, fallback e reduced-motion;
- a página passa `EVAL.md`.

# Limites de runtime de `src/lib`

A biblioteca é organizada por ambiente de execução para manter o cliente web desacoplado do backend e facilitar futuras distribuições desktop/mobile.

## `shared/`

Código puro compartilhável entre cliente e servidor: contratos, tipos, configurações e regras determinísticas.

Não pode depender de React, Next.js, browser, PostgreSQL, `server-only`, `client/` ou `server/`.

## `client/`

Código executado no navegador: transporte HTTP, sincronização e estado exclusivamente client-side.

Pode depender de `shared/`, mas não pode importar `server/`, PostgreSQL ou `server-only`.

## `server/`

Código autoritativo executado no servidor: transações, persistência e serviços que podem acessar recursos privados.

Pode depender de `shared/`, mas não pode depender da implementação em `client/`.

## `app/api`

Os Route Handlers do Next.js são adaptadores HTTP. Eles podem usar `server/` e `shared/`, mas não devem conter regra de domínio nem depender de `client/`.

## Compatibilidade durante a migração

Alguns módulos históricos em `src/lib/*.ts` permanecem temporariamente como reexports para evitar uma troca massiva de imports em um único passo. A implementação canônica dos módulos já migrados vive em `client/`, `server/` ou `shared/`.

Novos módulos devem ser criados diretamente na fronteira correta. Os shims antigos não devem receber nova lógica.

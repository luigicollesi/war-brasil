---
name: frontend-quality
description: >
  Use esta skill para revisar, implementar ou corrigir qualidade de frontend no WAR Brasil.
  A referência principal é o repositório público Front-End Checklist:
  https://github.com/thedaviddias/Front-End-Checklist
---

# Frontend Quality — WAR Brasil

## Objetivo

Usar o [Front-End Checklist](https://github.com/thedaviddias/Front-End-Checklist) como referência externa de qualidade para alterações de frontend no WAR Brasil, sem copiar ou manter localmente o catálogo completo de regras.

Fonte principal:

- Repositório: https://github.com/thedaviddias/Front-End-Checklist
- Catálogo de regras: https://github.com/thedaviddias/Front-End-Checklist/tree/main/packages/content/rules/en
- Especificação das regras: https://github.com/thedaviddias/Front-End-Checklist/blob/main/SPEC.md
- Checklist consolidada: https://github.com/thedaviddias/Front-End-Checklist/blob/main/README.md

Quando uma regra precisar ser usada para justificar uma alteração, consulte a versão atual da fonte em vez de assumir que uma cópia antiga continua correta.

## Quando usar

Use esta skill em tarefas envolvendo:

- React ou Next.js;
- HTML semântico;
- CSS e CSS Modules;
- responsividade;
- overflow e enquadramento;
- acessibilidade;
- navegação por teclado;
- foco;
- modais e formulários;
- animações;
- `prefers-reduced-motion`;
- imagens e assets;
- performance de frontend;
- Core Web Vitals;
- carregamento de scripts e estilos;
- SEO técnico;
- segurança de frontend;
- privacidade;
- internacionalização;
- testes de frontend;
- regressão visual;
- compatibilidade entre navegadores.

Não use esta skill para regras de gameplay, banco de dados, migrations, realtime ou backend quando a alteração não afetar a interface.

## Prioridade de análise

Para o WAR Brasil, priorize nesta ordem quando forem relevantes ao escopo:

1. funcionalidade quebrada ou conteúdo inacessível;
2. segurança;
3. acessibilidade;
4. responsividade e ausência de overflow;
5. performance percebida e Core Web Vitals;
6. estabilidade visual;
7. imagens, fontes e assets;
8. SEO para páginas públicas;
9. boas práticas de manutenção.

A prioridade específica da regra deve respeitar a classificação atual do Front-End Checklist quando ela existir.

## Fluxo de trabalho

1. Inspecione primeiro o código e os estilos existentes.
2. Preserve arquitetura, identidade visual e comportamento já especificados pelo projeto.
3. Identifique somente as categorias do Front-End Checklist relacionadas à tarefa.
4. Consulte as regras atuais na fonte externa quando necessário.
5. Aplique apenas recomendações compatíveis com o contexto real do WAR Brasil.
6. Não faça refactors ou mudanças visuais sem relação com a tarefa apenas para satisfazer uma checklist.
7. Quando houver conflito entre uma recomendação genérica e um requisito explícito do projeto, preserve o requisito do projeto e documente a exceção quando ela tiver impacto relevante.
8. Valide com os testes e checks finitos já existentes no repositório.

## Regras especialmente relevantes para este projeto

Ao trabalhar em layouts e componentes, verifique principalmente:

- ausência de scroll horizontal acidental;
- conteúdo enquadrado em viewports estreitos;
- uso correto de `min-width: 0`, wrapping e sizing responsivo;
- legibilidade em resoluções e alturas reduzidas;
- suporte a teclado;
- foco visível;
- labels e mensagens de erro acessíveis;
- contraste suficiente;
- estados não comunicados somente por cor;
- redução de movimento quando solicitada pelo sistema;
- animações sem bloquear interação;
- imagens com dimensões e formatos adequados;
- evitar assets desnecessariamente pesados;
- carregamento lazy quando apropriado;
- evitar bloqueio desnecessário de renderização;
- evitar layout shift;
- preservar semântica HTML;
- evitar conteúdo interativo aninhado incorretamente;
- testes de fluxos críticos em viewport desktop e mobile;
- regressão visual quando uma mudança depende fortemente do layout.

## Evidência e recomendações

Ao apontar um problema:

- prefira uma regra concreta do Front-End Checklist;
- diferencie regra aplicável de sugestão opcional;
- não invente requisito que não esteja no projeto ou na fonte;
- descreva o impacto observável;
- proponha a menor correção que preserve o comportamento atual.

Quando citar a fonte em documentação ou revisão, prefira links permanentes para a regra ou para o arquivo correspondente no repositório oficial.

## Limites

Esta skill é uma referência de qualidade, não uma autorização para:

- adicionar dependências sem necessidade;
- reescrever componentes estáveis;
- trocar tecnologias;
- alterar gameplay;
- mudar identidade visual;
- remover animações deliberadas;
- criar novos gates de CI;
- iniciar servidores locais;
- executar deploys.

Siga sempre o `AGENTS.md` do WAR Brasil e as convenções existentes no repositório.

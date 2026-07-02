# web-project-template

Ponto de partida pra apps web. Bun, Vite, React 19, TanStack Router, shadcn/ui, deploy em GitHub Pages privado.

Pare de redecidir o que é chato. Aqui já tem routing, tema, data tables, forms validados, lint, format, testes e CI prontos.

## Como usar

Clique em "Use this template" no GitHub pra criar um repo privado novo, depois:

```bash
bun install
bun run init      # renomeia o projeto, limpa o exemplo e regenera as rotas
bun run dev
```

O `bun run dev` sobe o Vite via [portless](https://github.com/vercel-labs/portless), em `suaferramenta.localhost` (HTTPS, porta estável), ótimo na própria máquina. Pra acessar de outro device na LAN (`nome-da-maquina:5173` ou IP), use `bun run dev:host`, que expõe o Vite em `0.0.0.0`. O portless é local-only.

## O que vem dentro

- TanStack Router: rotas file-based em `src/routes`, tipadas de ponta a ponta, com code splitting por rota
- shadcn/ui e Tailwind v4: dark e light mode prontos
- TanStack Table e Query: um `DataTable` reutilizável e o Query montado na raiz
- react-hook-form e Zod: forms type-safe, veja o dashboard de exemplo
- oxlint e oxfmt: lint e format rápidos em Rust, um comando só, `bun run doctor`
- bun test e Playwright: testes unitários com Testing Library, e2e com locators acessíveis
- knip: caça código morto e dependências não usadas
- lefthook: pre-commit formata e linta, pre-push roda knip e testes
- GitHub Actions: checks no PR e um deploy pro Pages que resolve deep link de SPA

O dashboard de exemplo (`/dashboard`, `src/features/members.tsx`) mostra o padrão tabela-e-form de ponta a ponta. O `bun run init` apaga ele.

## Comandos

| Comando                | Faz                                               |
| ---------------------- | ------------------------------------------------- |
| `bun run dev`          | Dev via portless (`*.localhost`, local)           |
| `bun run dev:host`     | Dev exposto na LAN (`0.0.0.0`)                    |
| `bun run doctor`       | Lint, checagem de format, typecheck, knip, testes |
| `bun run react-doctor` | Health check de React (anti-padrões)              |
| `bun run test`         | Testes unitários                                  |
| `bun run test:e2e`     | Playwright                                        |
| `bun run build`        | Bundle de produção                                |
| `bun run format`       | Formata com oxfmt                                 |

## Deploy

Dá push na `main` e o workflow `deploy-pages` builda com `BASE_PATH=/<repo>/`, copia o `index.html` pra `404.html` (pros deep links sobreviverem ao refresh) e publica no GitHub Pages, em `owner.github.io/<repo>`. Configure o Pages → Source do repo pra GitHub Actions uma vez. Pages publicado é público mesmo com o repo privado (a não ser que seja GitHub Enterprise Cloud com Pages privado de verdade), então não tem auth no app — não guarde nada sensível no bundle.

## Skills sugeridas

Trabalhando nesse repo com o Claude Code, vale usar:

- `/emil-design-eng` e `/frontend-design:frontend-design`, pra polimento de UI e direção visual
- `/web-design-guidelines`, pra revisão de acessibilidade e interface
- `/vercel-react-best-practices`, pra padrões de performance de React e Next
- `/read-the-damn-docs`, pra puxar a doc oficial atual antes de integrar uma lib
- `/playwright-cli`, pra dirigir o browser em e2e e screenshots
- `/improve`, pra auditar o codebase e gerar um plano de melhorias priorizado
- `/doctor`, o gate local (oxlint, oxfmt, bun test, knip)
- `/ai-slop-cleaner` (omc), pra tirar o slop de IA do código e da prosa

A prosa nesse repo segue o `docs/anti-slop-guidelines.md`.

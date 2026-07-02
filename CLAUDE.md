# CLAUDE.md

tools and dashboards. Bun, Vite, React 19, deployed to GitHub Pages.

## Commands

- `bun run dev`: dev server via portless (`name.localhost`, local machine only). `bun run dev:host` binds `0.0.0.0` for LAN access at `machine-name:5173` or IP, and is what Playwright and CI use.
- `bun run doctor`: oxlint, oxfmt check, typecheck, knip, unit tests. Run before every commit.
- `bun run react-doctor`: React-specific health scan (anti-patterns, perf, a11y) layered on oxlint. Vendored `ui/` and generated files are excluded via `doctor.config.json`; the CI action reports only PR-introduced issues.
- `bun run test`: unit tests (bun test, scoped to `src`).
- `bun run test:e2e`: Playwright end-to-end.
- `bun run build`: typecheck then production bundle.
- `bunx shadcn@latest add <component>`: pull a new shadcn component.

## Stack

Routing is TanStack Router, file-based in `src/routes`, with `autoCodeSplitting` on. `routeTree.gen.ts` is generated, so never edit it; it stays committed so typecheck works without a dev server.

UI is shadcn/ui (preset `b1YnRGLNI`) on Tailwind v4. Components in `src/components/ui` are vendored, so don't hand-edit them unless you mean to.

Data goes through TanStack Query, wired in `src/main.tsx`. Fetch with it, not in `useEffect`. These tools rarely call APIs, so there's no client layer baked in. Add one when a tool needs it.

Forms use react-hook-form and Zod (`zodResolver`); see `src/features/members.tsx`. Tables use TanStack Table through the reusable `src/components/data-table.tsx`. Theme is next-themes, switched from the gear menu in `src/components/settings-menu.tsx`.

## Structure

```
src/
  routes/            file-based routes (__root, index, dashboard)
  components/         app components (data-table, settings-menu, route-error)
  components/ui/      shadcn, vendored, excluded from knip and the fast-refresh lint rule
  features/           feature modules (data + schema + columns + form co-located)
  lib/               query-client, cn util
  test/              bun test setup + jest-dom matcher types
e2e/                 Playwright specs
.github/workflows/   ci.yml (PR checks) + deploy-pages.yml
```

## Adding a route

Create `src/routes/<name>.tsx` exporting `Route = createFileRoute('/<name>')({ component })`. The plugin regenerates `routeTree.gen.ts` on the next dev or build. Link with the typed `<Link to="/<name>">`; wrong paths fail typecheck.

## Conventions

The global `~/.claude/CLAUDE.md` rules apply. Project-specific notes:

- oxlint and oxfmt own lint and format. Config in `.oxlintrc.json` and `.oxfmtrc.json`: single quotes, no semicolons, width 100, sorted imports. `bun run doctor` is the gate.
- Named exports only (`import/no-default-export` is an error). Config files are the only exception.
- `any` is an error. `console` is a warning. Unused vars must be prefixed `_` or deleted.
- Accessibility is enforced (`jsx-a11y`). Use accessible roles and labels, and query by them in tests.
- No narrating comments. If you reach for one to explain how code works, extract a named function or variable instead. The only comments worth keeping are docstrings (JSDoc/doxygen) and the rare load-bearing "why" that prevents a maintainer from breaking something.

## Deploy

Static SPA on GitHub Pages, served at `owner.github.io/<repo>`. The deploy workflow sets `BASE_PATH=/<repo>/` from the repo name at build time; the deploy workflow copies `index.html` to `404.html` so deep links survive a refresh. Router `basepath` reads `import.meta.env.BASE_URL`, so it follows the build base. If a Pages setup serves at the subdomain root instead (e.g. GitHub Enterprise Cloud's private Pages with subdomain isolation), drop `BASE_PATH` from the workflow so the default base `/` applies.

## Testing

Test behavior, not implementation. Query by role and label, never by class or test-id. Unit tests use bun test with happy-dom and Testing Library; e2e uses Playwright with accessible locators. Write a test for every bug you fix.

## Writing

All prose (docs, comments, commit messages, PR descriptions) follows `docs/anti-slop-guidelines.md`. Lead with the result, cut filler, stay specific.

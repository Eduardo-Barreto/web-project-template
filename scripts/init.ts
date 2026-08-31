#!/usr/bin/env bun
/**
 * One-shot setup after "Use this template": renames the project, clears the
 * example dashboard and this repo's own decision record, regenerates the route
 * tree, then removes itself.
 *
 * Usage: bun run init [project-name]
 */

import { rm } from 'node:fs/promises'
import { basename } from 'node:path'

import { Generator, getConfig } from '@tanstack/router-generator'
import { z } from 'zod'

const editablePackageJson = z.looseObject({
  name: z.string(),
  scripts: z.record(z.string(), z.string()),
  devDependencies: z.record(z.string(), z.string()).optional(),
})

const editableKnipConfig = z.looseObject({
  ignoreDependencies: z.array(z.string()),
})

type EditablePackageJson = z.infer<typeof editablePackageJson>
type EditableKnipConfig = z.infer<typeof editableKnipConfig>

/** Narrows parsed JSON to the fields this script edits, leaving every other key untouched. */
function isEditablePackageJson(value: unknown): value is EditablePackageJson {
  return editablePackageJson.safeParse(value).success
}

/** Narrows parsed knip.json to the one array this script appends to. */
function isEditableKnipConfig(value: unknown): value is EditableKnipConfig {
  return editableKnipConfig.safeParse(value).success
}

const root = process.cwd()
const projectName = (process.argv[2] ?? basename(root))
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '')

async function rewrite(path: string, edit: (input: string) => string) {
  const file = Bun.file(path)
  await Bun.write(path, edit(await file.text()))
}

await rewrite('package.json', (input) => {
  const pkg: unknown = JSON.parse(input)
  if (!isEditablePackageJson(pkg)) {
    throw new Error('package.json has no string `name` or `scripts` map; refusing to rewrite it.')
  }
  pkg.name = projectName
  delete pkg.scripts.init
  // Only this script imports the generator. Left installed, knip reports it and `bun run
  // doctor` fails on a fresh project's first run.
  delete pkg.devDependencies?.['@tanstack/router-generator']
  return `${JSON.stringify(pkg, null, 2)}\n`
})

// Both have to stay installed after the example dashboard goes: src/components/ui/form.tsx
// imports react-hook-form from inside the vendored directory knip is told to ignore, and
// project/form-requires-zod-resolver mandates zodResolver on the first form written here.
// Applied at init rather than committed, because the dashboard makes both entries redundant
// in this repo and knip reports a redundant ignore.
await rewrite('knip.json', (input) => {
  const config: unknown = JSON.parse(input)
  if (!isEditableKnipConfig(config)) {
    throw new Error('knip.json has no `ignoreDependencies` array; refusing to rewrite it.')
  }
  const alreadyIgnored = new Set(config.ignoreDependencies)
  for (const dependency of ['react-hook-form', '@hookform/resolvers']) {
    if (!alreadyIgnored.has(dependency)) config.ignoreDependencies.push(dependency)
  }
  return `${JSON.stringify(config, null, 2)}\n`
})

await rewrite('index.html', (input) =>
  input.replace(/<title>.*<\/title>/, `<title>${projectName}</title>`),
)

await Promise.all([
  rm('src/routes/dashboard.tsx', { force: true }),
  rm('src/features', { recursive: true, force: true }),
  rm('e2e/dashboard.spec.ts', { force: true }),
  // This repo's own migration record, not documentation the new project can act on.
  rm('docs/deliver-decisions.md', { force: true }),
])

await Bun.write(
  'src/routes/index.tsx',
  `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return <h1 className="text-2xl font-semibold tracking-tight">${projectName}</h1>
}
`,
)

// The decisions file goes with the example dashboard, so the prose that pointed at it
// would otherwise name a path this project no longer has.
await rewrite('CLAUDE.md', (input) =>
  input
    .replace(' The rationale for that split is in `docs/deliver-decisions.md`.', '')
    .replace('; see `src/features/members.tsx`', ''),
)

await rewrite('README.md', (input) =>
  input
    .replace(', e o porquê de cada peça em `docs/deliver-decisions.md`', '')
    .replace(': forms type-safe, veja o dashboard de exemplo', ': forms type-safe')
    .replace(
      /\nO dashboard de exemplo \(`\/dashboard`, `src\/features\/members\.tsx`\)[^\n]*\n/,
      '',
    ),
)

await rewrite('src/routes/__root.tsx', (input) =>
  input
    .replace(
      /const navLinks = \[[\s\S]*?\] as const/,
      `const navLinks = [{ to: '/', label: 'Início' }] as const`,
    )
    .replace(/(<span className="font-semibold">).*?(<\/span>)/, `$1${projectName}$2`),
)

// Regenerate the route tree so it stops importing the deleted route.
const config = getConfig({ target: 'react', autoCodeSplitting: true }, root)
await new Generator({ config, root }).run()

await Bun.write(
  'e2e/smoke.spec.ts',
  // The describe wrapper is not decoration: project/require-top-level-describe is an error,
  // so a bare test() here fails `bun run doctor` on a fresh project's first run.
  `import { expect, test } from '@playwright/test'

test.describe('Home', () => {
  test('carrega', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '${projectName}' })).toBeVisible()
  })
})
`,
)

// This file and its test only. `scripts/` also holds scope-hash.ts and diff-policy.ts,
// which `bun run policy` and the gh-pr-create hook import: removing the directory left a
// fresh project with a broken doctor, a broken policy, and a PR gate that failed open.
await Promise.all([
  rm('scripts/init.ts', { force: true }),
  rm('scripts/init.test.ts', { force: true }),
])

await Bun.$`bunx oxfmt .`.quiet()

const check = await Bun.$`bun run typecheck`.nothrow().quiet()
console.log(`Pronto. Projeto renomeado pra "${projectName}".`)
console.log(
  check.exitCode === 0
    ? 'Typecheck passou. Rode: bun run dev'
    : `Typecheck falhou, confira:\n${check.stderr.toString()}`,
)
console.log(
  '\nAntes de abrir o primeiro PR: gere um token com `claude setup-token` e salve como secret CLAUDE_CODE_OAUTH_TOKEN no repo, senão o review adversarial não roda.',
)

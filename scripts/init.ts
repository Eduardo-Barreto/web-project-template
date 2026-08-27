#!/usr/bin/env bun
/**
 * One-shot setup after "Use this template": renames the project, clears the
 * example dashboard, regenerates the route tree, then removes itself.
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
})

type EditablePackageJson = z.infer<typeof editablePackageJson>

/** Narrows parsed JSON to the fields this script edits, leaving every other key untouched. */
function isEditablePackageJson(value: unknown): value is EditablePackageJson {
  return editablePackageJson.safeParse(value).success
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
  return `${JSON.stringify(pkg, null, 2)}\n`
})

await rewrite('index.html', (input) =>
  input.replace(/<title>.*<\/title>/, `<title>${projectName}</title>`),
)

await Promise.all([
  rm('src/routes/dashboard.tsx', { force: true }),
  rm('src/features', { recursive: true, force: true }),
  rm('e2e/dashboard.spec.ts', { force: true }),
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
  `import { expect, test } from '@playwright/test'

test('a home carrega', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: '${projectName}' }),
  ).toBeVisible()
})
`,
)

await rm('scripts', { recursive: true, force: true })

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

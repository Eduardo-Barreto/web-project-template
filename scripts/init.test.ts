// Integration test for `bun run init`, the one command every project made from this template
// runs first and the one nothing else exercised. It shipped broken three ways at once: it
// deleted scripts/ wholesale, generated an e2e spec that violated the repo's own lint rule,
// and left dependencies behind that knip then reported. So this runs the real script against
// a real copy of the tree and checks the result the way a new project would.
//
// The copy is the working tree, not HEAD, so an uncommitted change to init.ts is what gets
// tested. node_modules is symlinked entry by entry rather than installed, which keeps this in
// seconds; `.tmp` is a real directory in the copy so the probe's incremental tsc state can't
// leak into this repo's.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPO_ROOT = join(import.meta.dir, '..')
const PROJECT_NAME = 'probe-app'
const STEP_TIMEOUT_MS = 120_000
const ARCHIVE_MAX_BYTES = 64 * 1024 * 1024

let project = ''

type Step = ReturnType<typeof run>

function run(command: string, args: string[], options: { input?: string } = {}) {
  return spawnSync(command, args, {
    cwd: project,
    encoding: 'utf8',
    timeout: STEP_TIMEOUT_MS,
    ...options,
  })
}

/** Combined output of a failed step, or '' when it succeeded, so an assertion can show why. */
function failureOutput(step: Step): string {
  return step.status === 0 ? '' : `${step.stdout}${step.stderr}`.trim()
}

function copyWorkingTree(destination: string): void {
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout
  const archive = spawnSync('tar', ['-c', '--null', '-T', '-', '-f', '-'], {
    cwd: REPO_ROOT,
    input: tracked,
    maxBuffer: ARCHIVE_MAX_BYTES,
  })
  spawnSync('tar', ['-x', '-C', destination], { input: archive.stdout })
}

function linkDependencies(destination: string): void {
  const source = join(REPO_ROOT, 'node_modules')
  const target = join(destination, 'node_modules')
  mkdirSync(target)
  for (const entry of readdirSync(source)) {
    if (entry !== '.tmp') symlinkSync(join(source, entry), join(target, entry))
  }
  mkdirSync(join(target, '.tmp'))
}

describe('bun run init', () => {
  beforeAll(() => {
    project = mkdtempSync(join(tmpdir(), 'init-'))
    copyWorkingTree(project)
    linkDependencies(project)
    // scope-hash.ts resolves a merge-base, so the copy has to be a repo with one commit.
    run('git', ['init', '-q', '-b', 'main'])
    run('git', ['add', '-A'])
    run('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'])

    expect(failureOutput(run('bun', ['scripts/init.ts', PROJECT_NAME]))).toBe('')
  })

  afterAll(() => {
    if (project) rmSync(project, { recursive: true, force: true })
  })

  test('keeps the scripts/ modules the hooks and package scripts import', () => {
    expect(existsSync(join(project, 'scripts', 'scope-hash.ts'))).toBe(true)
    expect(existsSync(join(project, 'scripts', 'diff-policy.ts'))).toBe(true)
    expect(existsSync(join(project, 'scripts', 'init.ts'))).toBe(false)
  })

  // Not `bun run doctor`: its test step would re-enter this file and recurse. These are the
  // three doctor checks a fresh project can actually fail.
  test('leaves a project that typechecks', () => {
    expect(failureOutput(run('bunx', ['tsc', '-b']))).toBe('')
  })

  test('leaves a project that lints, including the e2e spec init generates', () => {
    expect(failureOutput(run('bunx', ['oxlint']))).toBe('')
  })

  test('leaves no dependency knip reports as unused', () => {
    expect(failureOutput(run('bunx', ['knip']))).toBe('')
  })

  test('leaves a working bun run policy', () => {
    expect(failureOutput(run('bun', ['run', 'policy']))).toBe('')
  })

  test('leaves a PR gate that still blocks', () => {
    const payload = { tool_input: { command: 'gh pr create --title x' } }
    const hook = spawnSync('bun', [join(project, '.claude/hooks/require-review.ts')], {
      cwd: project,
      encoding: 'utf8',
      input: JSON.stringify(payload),
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    })

    expect(hook.status).toBe(2)
    expect(hook.stderr).toContain('review-judgment')
  })

  test('drops the prose that pointed at files it deleted', () => {
    for (const doc of ['CLAUDE.md', 'README.md']) {
      const content = readFileSync(join(project, doc), 'utf8')

      expect(content).not.toContain('deliver-decisions.md')
      expect(content).not.toContain('src/features/members.tsx')
    }
  })
})

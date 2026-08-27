// Integration tests against a real throwaway repo. The behaviour that matters is that
// committing does not change the hash, since that is the whole reason it replaced the
// commit-timestamp freshness check.

import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT_PATH = join(import.meta.dir, 'scope-hash.ts')

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}: ${result.stderr}`)
  return result.stdout.trim()
}

function hashIn(repo: string): string {
  return run('bun', [SCRIPT_PATH], repo)
}

function makeBranchWithChange(): string {
  const repo = mkdtempSync(join(tmpdir(), 'scope-hash-'))
  run('git', ['init', '-b', 'main'], repo)
  run('git', ['config', 'user.email', 'test@example.com'], repo)
  run('git', ['config', 'user.name', 'Test'], repo)
  writeFileSync(join(repo, 'base.txt'), 'base\n')
  run('git', ['add', 'base.txt'], repo)
  run('git', ['commit', '-m', 'base'], repo)
  run('git', ['checkout', '-b', 'feature'], repo)
  writeFileSync(join(repo, 'feature.txt'), 'work in progress\n')
  return repo
}

describe('scope hash', () => {
  test('returns the same hash for the same working tree', () => {
    const repo = makeBranchWithChange()
    try {
      expect(hashIn(repo)).toBe(hashIn(repo))
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('survives committing the change it already covered', () => {
    const repo = makeBranchWithChange()
    try {
      const beforeCommit = hashIn(repo)
      run('git', ['add', 'feature.txt'], repo)
      run('git', ['commit', '-m', 'feature'], repo)

      expect(hashIn(repo)).toBe(beforeCommit)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('survives amending that commit', () => {
    const repo = makeBranchWithChange()
    try {
      run('git', ['add', 'feature.txt'], repo)
      run('git', ['commit', '-m', 'feature'], repo)
      const beforeAmend = hashIn(repo)
      run('git', ['commit', '--amend', '-m', 'feature, reworded'], repo)

      expect(hashIn(repo)).toBe(beforeAmend)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('changes when the code changes', () => {
    const repo = makeBranchWithChange()
    try {
      const before = hashIn(repo)
      writeFileSync(join(repo, 'feature.txt'), 'work in progress, revised\n')

      expect(hashIn(repo)).not.toBe(before)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('changes when a new file joins the scope', () => {
    const repo = makeBranchWithChange()
    try {
      const before = hashIn(repo)
      writeFileSync(join(repo, 'extra.txt'), 'another file\n')

      expect(hashIn(repo)).not.toBe(before)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})

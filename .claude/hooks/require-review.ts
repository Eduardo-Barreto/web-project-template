#!/usr/bin/env bun
// Blocks `gh pr create` unless the deterministic gate passes and the one LLM reviewer
// signed off on the code as it stands right now. `bun run doctor` covers everything a
// parser can decide; review-judgment covers intent, cross-file logic and architectural
// fit. It can't stop an orchestrator that deliberately writes a fake PASS, only an
// honest mistake: a reviewer skipped, forgotten, or misremembered when summarized back
// into the conversation.
// console.error here is the hook's protocol with Claude Code: stderr becomes the block
// reason. See the `.claude/**` override for `eslint/no-console` in .oxlintrc.json.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { scopeHash } from '../../scripts/scope-hash.ts'
import { FINDINGS_DIR, JUDGMENT_REVIEWER, judgmentBlocker } from './findings-status.ts'
import { isRecord, readHookPayload, requireProjectDir, runHookGuard } from './hook-input.ts'
import { isPrCreateCommand } from './pr-create-matcher.ts'

// This hook runs on every Bash call, not just `gh pr create`: a settings.json
// `if` filter is pattern-based and can miss a real invocation (an absolute
// path, an alias, a compound command), which would silently skip the gate.
// Checking the real command here, every time, is the only way to guarantee
// this hook actually sees every `gh pr create` call.
function actualBashCommand(): string | null {
  const payload = readHookPayload()
  if (!payload || !isRecord(payload.tool_input)) return null
  const command = payload.tool_input.command
  return typeof command === 'string' ? command : null
}

const command = actualBashCommand()
if (command !== null && !isPrCreateCommand(command)) {
  process.exit(0)
}

// Two gates run sequentially, so this has to stay comfortably under half of this hook's own
// 300s PreToolUse timeout in settings.json. A cancelled PreToolUse hook returns no deny
// decision, so an internal timeout that can never fire turns a hung gate into an open one.
// Measured: doctor ~4s, policy ~1s.
const GATE_TIMEOUT_MS = 120_000
const GATE_OUTPUT_TAIL_LINES = 20

function firstLineOfFindings(): string | null {
  const file = join(FINDINGS_DIR, `${JUDGMENT_REVIEWER}.md`)
  if (!existsSync(file)) return null
  return readFileSync(file, 'utf8').split('\n', 1)[0] ?? ''
}

/**
 * Runs one deterministic gate script.
 * @throws with the tail of its output when it fails, so the block reason names the real problem
 */
function requireGate(script: string): void {
  const gate = spawnSync('bun', ['run', script], {
    encoding: 'utf8',
    timeout: GATE_TIMEOUT_MS,
  })
  if (gate.status === 0) return

  // Both streams: oxlint and tsc report diagnostics on stderr, so a
  // stdout-only tail comes back empty on exactly the failures worth quoting.
  const tail = `${gate.stdout}${gate.stderr}`
    .trim()
    .split('\n')
    .slice(-GATE_OUTPUT_TAIL_LINES)
    .join('\n')
  throw new Error(
    `bun run ${script} failed, so this diff isn't ready for a PR. Fix these, then retry.\n\n${tail || String(gate.error)}`,
  )
}

// Past this point the command is (or might be) `gh pr create`, so failures
// below fail closed: this hook exists to stop an unreviewed PR from opening,
// and an internal error here is not a reason to let one through.
runHookGuard(() => {
  requireProjectDir('open a PR without checking reviews', 2)

  const blocker = judgmentBlocker(firstLineOfFindings(), scopeHash())
  if (blocker !== null) throw new Error(blocker)

  requireGate('doctor')
  requireGate('policy')
})

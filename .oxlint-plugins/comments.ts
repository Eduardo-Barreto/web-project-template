/**
 * Comment-policy rules from CLAUDE.md: English only, docstrings on exported functions,
 * and no shortcut disclosed in prose without a tracked issue behind it.
 */

import { type ESTree, defineRule } from '@oxlint/plugins'

// No `dos`, `das` or `para`: they collide with "DoS", "DOS" and "para-virtualized" in English
// technical prose, and a false positive here blocks a commit over a correct comment.
const PORTUGUESE_WORDS =
  /\b(?:não|então|porque|também|apenas|isso|esse|essa|agora|precisa|deve|está|são|seja|pode|mas|uma|pelo|pela|aqui|sempre|nunca|quando|onde)\b/i
const PORTUGUESE_DIACRITICS = /[ãõçáéíóúâêôàü]/i
const WORKAROUND_TERMS = /\b(?:todo|fixme|hack|xxx|workaround|for now|temporary|gambiarra)\b/i
const TRACKED_REFERENCE = /#\d+|https?:\/\//
const DOCSTRING_START = '*'

/** True when the initializer is a function, which is what makes an export worth documenting. */
function isFunctionValue(node: ESTree.Expression | null | undefined): boolean {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression'
}

export const commentMustBeEnglish = defineRule({
  meta: {
    messages: {
      english: 'Write comments in English, even in a file that already has non-English ones.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (PORTUGUESE_WORDS.test(comment.value) || PORTUGUESE_DIACRITICS.test(comment.value)) {
            context.report({ loc: context.sourceCode.getLoc(comment), messageId: 'english' })
          }
        }
      },
    }
  },
})

export const workaroundNeedsIssueLink = defineRule({
  meta: {
    messages: {
      link: 'A workaround comment without an issue number or upstream link is a confession, not documentation.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (WORKAROUND_TERMS.test(comment.value) && !TRACKED_REFERENCE.test(comment.value)) {
            context.report({ loc: context.sourceCode.getLoc(comment), messageId: 'link' })
          }
        }
      },
    }
  },
})

/**
 * Requires a TSDoc block on every exported function, whether it is exported inline
 * (`export function foo`) or in a separate list (`function foo` plus `export { foo }`).
 * The separate form is why this collects candidates first and decides on `Program:exit`:
 * the export can appear before or after the declaration it names.
 */
export const requireTsdocOnExports = defineRule({
  meta: {
    messages: {
      document: 'Document this exported function with a TSDoc block describing what it does.',
    },
  },
  create(context) {
    const exportedNames = new Set<string>()
    const candidates = new Map<string, ESTree.Node>()

    const isDocumented = (node: ESTree.Node) =>
      context.sourceCode
        .getCommentsBefore(node)
        .some((comment) => comment.type === 'Block' && comment.value.startsWith(DOCSTRING_START))

    return {
      ExportNamedDeclaration(node) {
        for (const specifier of node.specifiers) {
          if (specifier.local.type === 'Identifier') exportedNames.add(specifier.local.name)
        }
        const { declaration } = node
        if (declaration === null) return

        // Inline export: the docblock sits before the `export` keyword, not the declaration.
        if (declaration.type === 'FunctionDeclaration' && declaration.id !== null) {
          if (!isDocumented(node)) context.report({ node, messageId: 'document' })
          return
        }
        if (declaration.type !== 'VariableDeclaration') return
        if (declaration.declarations.some((declarator) => isFunctionValue(declarator.init))) {
          if (!isDocumented(node)) context.report({ node, messageId: 'document' })
        }
      },
      // `export default function foo` and `function foo` plus `export default foo`. Rare here,
      // since import/no-default-export is an error outside config files, but a rule that only
      // half-covers exports is worse than one that says so.
      ExportDefaultDeclaration(node) {
        const { declaration } = node
        if (declaration.type === 'Identifier') {
          exportedNames.add(declaration.name)
          return
        }
        const exportsFunction =
          declaration.type === 'FunctionDeclaration' ||
          declaration.type === 'ArrowFunctionExpression' ||
          declaration.type === 'FunctionExpression'
        if (exportsFunction && !isDocumented(node)) {
          context.report({ node, messageId: 'document' })
        }
      },
      FunctionDeclaration(node) {
        if (node.id !== null && node.parent.type !== 'ExportNamedDeclaration') {
          candidates.set(node.id.name, node)
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && isFunctionValue(node.init)) {
          candidates.set(node.id.name, node)
        }
      },
      'Program:exit'() {
        for (const [name, node] of candidates) {
          if (!exportedNames.has(name)) continue
          if (!isDocumented(node)) context.report({ node, messageId: 'document' })
        }
      },
    }
  },
})

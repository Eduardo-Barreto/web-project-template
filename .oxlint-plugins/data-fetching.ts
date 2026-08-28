/**
 * Rules for this project's data-fetching and form conventions, the ones CLAUDE.md
 * states and no off-the-shelf lint rule checks.
 */

import { type ESTree, defineRule } from '@oxlint/plugins'

const RESPONSE_READ = /\.json\s*\(/
const ANCESTOR_LIMIT = 30
// The excluded receivers all have a `.parse` that converts rather than validates, so accepting
// one would let an unvalidated payload through under the appearance of a schema check. This is
// a heuristic on the receiver's name, not proof that what remains is a Zod schema: it catches
// the built-ins people actually reach for, and `review-judgment` owns the rest.
const NON_VALIDATING_PARSERS = String.raw`JSON|Date|url|Url|URL|querystring|qs|path`
const ZOD_PARSE = new RegExp(
  String.raw`(?<!\b(?:${NON_VALIDATING_PARSERS}))\.(?:safeParse|parse)(?:Async)?\s*\(`,
)

/** True for `fetch(...)`, `window.fetch(...)` and any `axios.get(...)`-style method. */
function isNetworkCall(callee: ESTree.Expression): boolean {
  if (callee.type === 'Identifier') return callee.name === 'fetch'
  if (callee.type !== 'MemberExpression' || callee.computed) return false
  if (callee.property.name === 'fetch') return true
  return callee.object.type === 'Identifier' && callee.object.name === 'axios'
}

export const noFetchInEffect = defineRule({
  meta: {
    messages: {
      useQuery: 'Fetch with TanStack Query, not inside useEffect. See CLAUDE.md.',
    },
  },
  create(context) {
    return {
      // Matched on the AST rather than on the effect's source text: a string literal that
      // merely contains "fetch(" is not a network call, and a comment about fetching is not
      // one either.
      CallExpression(node) {
        if (!isNetworkCall(node.callee)) return
        let current: ESTree.Node | null | undefined = node.parent
        for (
          let depth = 0;
          depth < ANCESTOR_LIMIT && current !== null && current !== undefined;
          depth += 1
        ) {
          if (
            current.type === 'CallExpression' &&
            current.callee.type === 'Identifier' &&
            current.callee.name === 'useEffect'
          ) {
            context.report({ node, messageId: 'useQuery' })
            return
          }
          current = 'parent' in current ? current.parent : undefined
        }
      },
    }
  },
})

export const queryKeyFromFactory = defineRule({
  meta: {
    messages: {
      useFactory:
        'Build queryKey from a key factory or enum, not a bare string. Magic cache keys drift silently.',
    },
  },
  create(context) {
    return {
      Property(node) {
        if (node.key.type !== 'Identifier' || node.key.name !== 'queryKey') return
        if (node.value.type !== 'ArrayExpression') return
        const [first] = node.value.elements
        if (first?.type === 'Literal' && typeof first.value === 'string') {
          context.report({ node: first, messageId: 'useFactory' })
        }
      },
    }
  },
})

export const formRequiresZodResolver = defineRule({
  meta: {
    messages: {
      addResolver: 'useForm needs a zodResolver: unvalidated form input is an untyped boundary.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'useForm') return
        const [options] = node.arguments
        // A `resolver` key isn't enough: `resolver: undefined` and `resolver: yupResolver(x)`
        // both satisfy the shape while leaving the form outside the contract this rule names.
        const hasResolver =
          options?.type === 'ObjectExpression' &&
          options.properties.some(
            (property) =>
              property.type === 'Property' &&
              property.key.type === 'Identifier' &&
              property.key.name === 'resolver' &&
              property.value.type === 'CallExpression' &&
              property.value.callee.type === 'Identifier' &&
              property.value.callee.name === 'zodResolver',
          )
        if (!hasResolver) {
          context.report({ node, messageId: 'addResolver' })
        }
      },
    }
  },
})

/**
 * Flags a function that reads a fetch payload without validating it anywhere in the same
 * function. Scoped to the function, not the expression, so `const raw = await res.json()`
 * followed by `schema.parse(raw)` stays clean.
 *
 * Covers declarations, arrows and function expressions (object and class methods). When the
 * offender nests, only the innermost function is reported: blaming the enclosing one too
 * points at a whole function body for a problem that lives on one line inside it.
 */
export const parseBeforeUse = defineRule({
  meta: {
    messages: {
      validate:
        'Validate this payload with a Zod schema before using it. An unparsed boundary is an any in disguise.',
    },
  },
  create(context) {
    const offenders: ESTree.Node[] = []

    /**
     * Source text of `node` with every comment blanked out, keeping the original offsets.
     * Matching raw text would let a comment merely mentioning `.parse(` satisfy the rule,
     * a false negative at exactly the boundary this rule exists to guard.
     */
    const codeWithoutComments = (node: ESTree.Node) => {
      const [nodeStart] = context.sourceCode.getRange(node)
      let text = context.sourceCode.getText(node)
      for (const comment of context.sourceCode.getCommentsInside(node)) {
        const [start, end] = context.sourceCode.getRange(comment)
        text =
          text.slice(0, start - nodeStart) + ' '.repeat(end - start) + text.slice(end - nodeStart)
      }
      return text
    }

    const collect = (node: ESTree.Node) => {
      const body = codeWithoutComments(node)
      if (RESPONSE_READ.test(body) && !ZOD_PARSE.test(body)) {
        offenders.push(node)
      }
    }

    const contains = (outer: ESTree.Node, inner: ESTree.Node) => {
      const [outerStart, outerEnd] = context.sourceCode.getRange(outer)
      const [innerStart, innerEnd] = context.sourceCode.getRange(inner)
      return outerStart <= innerStart && outerEnd >= innerEnd
    }

    return {
      FunctionDeclaration: collect,
      ArrowFunctionExpression: collect,
      FunctionExpression: collect,
      'Program:exit'() {
        for (const offender of offenders) {
          const nested = offenders.some((other) => other !== offender && contains(offender, other))
          if (!nested) {
            context.report({ node: offender, messageId: 'validate' })
          }
        }
      },
    }
  },
})

export const noManualLoadingBranch = defineRule({
  meta: {
    messages: {
      useSuspense:
        'Render loading state with <Suspense> and useSuspenseQuery instead of branching on isLoading.',
    },
  },
  create(context) {
    return {
      LogicalExpression(node) {
        if (node.operator !== '&&') return
        if (node.left.type === 'Identifier' && node.left.name === 'isLoading') {
          context.report({ node: node.left, messageId: 'useSuspense' })
        }
      },
      ConditionalExpression(node) {
        if (node.test.type === 'Identifier' && node.test.name === 'isLoading') {
          context.report({ node: node.test, messageId: 'useSuspense' })
        }
      },
    }
  },
})

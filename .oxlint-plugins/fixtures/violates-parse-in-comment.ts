/** Reads a payload without validating it, while a comment merely mentions parsing. */
export async function loadWithoutValidating() {
  const response = await fetch('/api/thing')
  // Response shape mirrors what schema.parse( ) would return.
  return await response.json()
}

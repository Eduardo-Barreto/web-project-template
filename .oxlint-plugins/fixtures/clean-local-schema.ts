import { z } from 'zod'

// A schema whose name does not end in Schema, which is how this repo actually names them
// (`editablePackageJson` in scripts/init.ts). Resolved by its initializer, not by convention,
// so the rule accepts it without the naming allow-list having to guess.
const editablePayload = z.object({ id: z.string() })

/** Reads a payload and validates it with a locally declared schema. */
export async function loadValidated(response: Response) {
  const raw: unknown = await response.json()
  return editablePayload.parse(raw)
}

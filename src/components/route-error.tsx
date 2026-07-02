import type { ErrorComponentProps } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
    >
      <h2 className="text-lg font-semibold">Algo quebrou</h2>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <Button onClick={reset}>Tentar de novo</Button>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
      <h2 className="text-lg font-semibold">Página não encontrada</h2>
      <p className="text-muted-foreground text-sm">A página que você pediu não existe.</p>
    </div>
  )
}

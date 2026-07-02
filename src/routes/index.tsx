import { Link, createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: Home,
})

const features = [
  {
    title: 'Rotas type-safe',
    body: 'TanStack Router com rotas file-based e code splitting automático.',
  },
  {
    title: 'shadcn/ui',
    body: 'Componentes com tema, dark mode e o preset já embutido.',
  },
  {
    title: 'Baterias inclusas',
    body: 'Data tables, forms com Zod, React Query e testes prontos pra usar.',
  },
]

function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Ferramentas internas começam aqui</h1>
        <p className="text-muted-foreground max-w-prose">
          Um template Bun + Vite + React pros dashboards que a gente vive refazendo. Troque esta
          página, mantenha a fiação.
        </p>
        <Button asChild>
          <Link to="/dashboard">Abrir o painel de exemplo</Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}

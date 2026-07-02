import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { DataTable } from '@/components/data-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type Member, MemberForm, initialMembers, memberColumns } from '@/features/members'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  const [members, setMembers] = useState<Member[]>(initialMembers)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Membros da equipe</h1>
        <p className="text-muted-foreground text-sm">
          Uma feature de exemplo: uma tabela tipada e um form validado.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Adicionar membro</CardTitle>
          <CardDescription>Validado com Zod, ligado no react-hook-form.</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberForm onAdd={(member) => setMembers((prev) => [...prev, member])} />
        </CardContent>
      </Card>
      <DataTable
        columns={memberColumns}
        data={members}
        label="Membros da equipe"
        filterColumn="name"
        filterPlaceholder="Filtrar membros..."
      />
    </div>
  )
}

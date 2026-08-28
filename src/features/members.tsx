import { zodResolver } from '@hookform/resolvers/zod'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const roles = ['Admin', 'Editor', 'Leitor'] as const

const memberSchema = z.object({
  name: z.string().min(2, 'O nome precisa de pelo menos 2 caracteres'),
  email: z.email('Informe um email válido'),
  role: z.enum(roles),
})

export type Member = z.infer<typeof memberSchema>

export const initialMembers: Member[] = [
  { name: 'Ana Maria', email: 'ana@grouplinkone.com', role: 'Admin' },
  { name: 'Romeu', email: 'romeu@grouplinkone.com', role: 'Editor' },
  { name: 'Julieta', email: 'julieta@grouplinkone.com', role: 'Leitor' },
]

export const memberColumns: ColumnDef<Member>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Nome
        <ArrowUpDown className="size-3.5" />
      </Button>
    ),
  },
  { accessorKey: 'email', header: 'Email' },
  {
    accessorKey: 'role',
    header: 'Cargo',
    cell: ({ row }) => <Badge variant="secondary">{row.original.role}</Badge>,
  },
]

/**
 * Form that validates a new team member against `memberSchema` before handing it up.
 * @param onAdd - called with the parsed member once the form passes validation
 */
export function MemberForm({ onAdd }: { onAdd: (member: Member) => void }) {
  const form = useForm<Member>({
    resolver: zodResolver(memberSchema),
    defaultValues: { name: '', email: '', role: 'Leitor' },
  })

  function onSubmit(member: Member) {
    onAdd(member)
    toast.success(`${member.name} adicionado`)
    form.reset()
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
        className="flex flex-wrap items-start gap-3"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Maria Silva" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="maria@grouplinkone.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cargo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="mt-6">
          Adicionar membro
        </Button>
      </form>
    </Form>
  )
}

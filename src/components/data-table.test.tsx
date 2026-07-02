import { describe, expect, test } from 'bun:test'

import type { ColumnDef } from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DataTable } from './data-table'

type Row = { name: string }

const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name' }]
const data: Row[] = Array.from({ length: 15 }, (_, index) => ({
  name: `Member ${index + 1}`,
}))

describe('DataTable', () => {
  test('shows the first page of rows', () => {
    render(<DataTable columns={columns} data={data} label="Members" />)

    expect(screen.getByText('Member 1')).toBeInTheDocument()
    expect(screen.queryByText('Member 11')).not.toBeInTheDocument()
  })

  test('reveals later rows when the reader pages forward', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} data={data} label="Members" />)

    await user.click(screen.getByRole('button', { name: 'Próximo' }))

    expect(screen.getByText('Member 11')).toBeInTheDocument()
  })

  test('narrows rows to those matching the filter', async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        columns={columns}
        data={data}
        label="Members"
        filterColumn="name"
        filterPlaceholder="Filter members"
      />,
    )

    await user.type(screen.getByLabelText('Filter members'), 'Member 12')

    expect(screen.getByText('Member 12')).toBeInTheDocument()
    expect(screen.queryByText('Member 1')).not.toBeInTheDocument()
  })

  test('reports an empty state when no rows match', async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        columns={columns}
        data={data}
        label="Members"
        filterColumn="name"
        filterPlaceholder="Filter members"
      />,
    )

    await user.type(screen.getByLabelText('Filter members'), 'nobody')

    expect(screen.getByText('Nenhum resultado.')).toBeInTheDocument()
  })

  test('gives the table an accessible name', () => {
    render(<DataTable columns={columns} data={data} label="Members" />)

    expect(screen.getByRole('table', { name: 'Members' })).toBeInTheDocument()
  })

  test('exposes sort state on sortable column headers', () => {
    render(<DataTable columns={columns} data={data} label="Members" />)

    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'none')
  })
})

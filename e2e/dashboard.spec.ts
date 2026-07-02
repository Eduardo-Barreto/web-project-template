import { expect, test } from '@playwright/test'

test.describe('Painel', () => {
  test('chega na lista de membros a partir da home', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Painel', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Membros da equipe' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'ana@grouplinkone.com' })).toBeVisible()
  })

  test('adiciona um membro pelo formulário', async ({ page }) => {
    await page.goto('/dashboard')

    await page.getByLabel('Nome').fill('Diego Reis')
    await page.getByLabel('Email').fill('diego@grouplinkone.com')
    await page.getByRole('button', { name: 'Adicionar membro' }).click()

    await expect(page.getByRole('cell', { name: 'Diego Reis' })).toBeVisible()
  })

  test('recusa um email inválido', async ({ page }) => {
    await page.goto('/dashboard')

    await page.getByLabel('Nome').fill('Email Ruim')
    await page.getByLabel('Email').fill('nao-e-email')
    await page.getByRole('button', { name: 'Adicionar membro' }).click()

    await expect(page.getByText('Informe um email válido')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Email Ruim' })).toHaveCount(0)
  })
})

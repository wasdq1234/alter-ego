import { test, expect } from '@playwright/test'

test.describe('Persona management', () => {
  test('shows persona list after login', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('+ New Persona')).toBeVisible()
  })

  test('can navigate to create persona form', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('+ New Persona')).toBeVisible({ timeout: 10_000 })
    await page.getByText('+ New Persona').click()

    await expect(page.getByRole('heading', { name: 'Create Persona' })).toBeVisible()
    await expect(page.getByPlaceholder('e.g. Luna')).toBeVisible()
    await expect(page.getByPlaceholder('Bright and positive')).toBeVisible()
    await expect(page.getByPlaceholder('Casual tone')).toBeVisible()
  })

  test('can create a new persona and see it in the list', async ({ page }) => {
    const personaName = `pw-test-${Date.now()}`

    await page.goto('/')
    await expect(page.getByText('+ New Persona')).toBeVisible({ timeout: 10_000 })
    await page.getByText('+ New Persona').click()

    // Fill form using placeholders
    await page.getByPlaceholder('e.g. Luna').fill(personaName)
    await page.getByPlaceholder('Bright and positive').fill('Helpful and brief')
    await page.getByPlaceholder('Casual tone').fill('Concise, formal')
    await page.getByRole('button', { name: 'Create' }).click()

    // Wait for API call to complete and redirect back to list
    await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(personaName)).toBeVisible()
  })

  test('can cancel persona creation', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('+ New Persona')).toBeVisible({ timeout: 10_000 })
    await page.getByText('+ New Persona').click()

    await expect(page.getByRole('heading', { name: 'Create Persona' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible()
  })
})

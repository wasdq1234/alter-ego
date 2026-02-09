import { test, expect } from '@playwright/test'

/**
 * Login fallback: if storageState token was invalidated, log in via UI.
 * Waits for the app to finish loading before checking state.
 */
async function loginAndWaitForList(page: import('@playwright/test').Page) {
  await page.goto('/')

  const heading = page.getByRole('heading', { name: 'My Personas' })
  const loginForm = page.getByText('Sign in to your account')

  await expect(heading.or(loginForm)).toBeVisible({ timeout: 10_000 })

  if (await heading.isVisible()) return

  await page.getByPlaceholder('Email').fill('test@alter-ego.dev')
  await page.getByPlaceholder('Password').fill('test123456')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(heading).toBeVisible({ timeout: 10_000 })
}

test.describe('Persona management', () => {
  test('shows persona list after login', async ({ page }) => {
    await loginAndWaitForList(page)
    await expect(page.getByText('+ New Persona')).toBeVisible()
  })

  test('can navigate to create persona form', async ({ page }) => {
    await loginAndWaitForList(page)
    await page.getByText('+ New Persona').click()

    await expect(page.getByRole('heading', { name: 'Create Persona' })).toBeVisible()
    await expect(page.getByPlaceholder('e.g. Luna')).toBeVisible()
    await expect(page.getByPlaceholder('Bright and positive')).toBeVisible()
    await expect(page.getByPlaceholder('Casual tone')).toBeVisible()
  })

  test('can create a new persona and see it in the list', async ({ page }) => {
    const personaName = `pw-test-${Date.now()}`

    await loginAndWaitForList(page)
    await page.getByText('+ New Persona').click()

    await page.getByPlaceholder('e.g. Luna').fill(personaName)
    await page.getByPlaceholder('Bright and positive').fill('Helpful and brief')
    await page.getByPlaceholder('Casual tone').fill('Concise, formal')
    await page.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(personaName)).toBeVisible()
  })

  test('can cancel persona creation', async ({ page }) => {
    await loginAndWaitForList(page)
    await page.getByText('+ New Persona').click()

    await expect(page.getByRole('heading', { name: 'Create Persona' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible()
  })
})

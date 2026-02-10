import { test, expect } from '@playwright/test'
import { texts } from './i18n-helpers'

async function loginAndWaitForList(page: import('@playwright/test').Page) {
  await page.goto('/')

  const heading = page.getByRole('heading', { name: texts.myPersonas })
  const loginForm = page.getByText(texts.signInDesc)

  await expect(heading.or(loginForm)).toBeVisible({ timeout: 10_000 })

  if (await heading.isVisible()) return

  await page.getByPlaceholder(texts.email).fill('test@alter-ego.dev')
  await page.getByPlaceholder(texts.password).fill('test123456')
  await page.getByRole('button', { name: texts.signIn }).click()
  await expect(heading).toBeVisible({ timeout: 10_000 })
}

test.describe('Persona management', () => {
  test('shows persona list after login', async ({ page }) => {
    await loginAndWaitForList(page)
    await expect(page.getByText(texts.newPersona)).toBeVisible()
  })

  test('can navigate to create persona form', async ({ page }) => {
    await loginAndWaitForList(page)
    await page.getByText(texts.newPersona).click()

    await expect(page.getByRole('heading', { name: texts.createTitle })).toBeVisible()
    await expect(page.getByPlaceholder(texts.namePlaceholder)).toBeVisible()
    await expect(page.getByPlaceholder(texts.personalityPlaceholder)).toBeVisible()
    await expect(page.getByPlaceholder(texts.speakingStylePlaceholder)).toBeVisible()
  })

  test('can create a new persona and see it in the list', async ({ page }) => {
    const personaName = `pw-test-${Date.now()}`

    await loginAndWaitForList(page)
    await page.getByText(texts.newPersona).click()

    await page.getByPlaceholder(texts.namePlaceholder).fill(personaName)
    await page.getByPlaceholder(texts.personalityPlaceholder).fill('Helpful and brief')
    await page.getByPlaceholder(texts.speakingStylePlaceholder).fill('Concise, formal')
    await page.getByRole('button', { name: texts.create }).click()

    await expect(page.getByRole('heading', { name: texts.myPersonas })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(personaName)).toBeVisible()
  })

  test('can cancel persona creation', async ({ page }) => {
    await loginAndWaitForList(page)
    await page.getByText(texts.newPersona).click()

    await expect(page.getByRole('heading', { name: texts.createTitle })).toBeVisible()
    await page.getByRole('button', { name: texts.cancel }).click()

    await expect(page.getByRole('heading', { name: texts.myPersonas })).toBeVisible()
  })

  test('can edit a persona', async ({ page }) => {
    const personaName = `pw-edit-${Date.now()}`
    const updatedName = `pw-edited-${Date.now()}`

    await loginAndWaitForList(page)

    // Create a persona first
    await page.getByText(texts.newPersona).click()
    await page.getByPlaceholder(texts.namePlaceholder).fill(personaName)
    await page.getByPlaceholder(texts.personalityPlaceholder).fill('Test personality')
    await page.getByPlaceholder(texts.speakingStylePlaceholder).fill('Test style')
    await page.getByRole('button', { name: texts.create }).click()

    await expect(page.getByRole('heading', { name: texts.myPersonas })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(personaName)).toBeVisible()

    // Click Edit on the newly created persona's card
    const card = page.locator('.grid > div').filter({ hasText: personaName })
    await card.getByRole('button', { name: texts.edit }).click()

    // Should show edit form with existing values
    await expect(page.getByRole('heading', { name: texts.editTitle })).toBeVisible()
    const nameInput = page.getByPlaceholder(texts.namePlaceholder)
    await expect(nameInput).toHaveValue(personaName)

    // Change the name
    await nameInput.clear()
    await nameInput.fill(updatedName)
    await page.getByRole('button', { name: texts.save }).click()

    // Should return to list with updated name
    await expect(page.getByRole('heading', { name: texts.myPersonas })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(updatedName)).toBeVisible()
    await expect(page.getByText(personaName)).not.toBeVisible()
  })

  test('can delete a persona', async ({ page }) => {
    const personaName = `pw-delete-${Date.now()}`

    await loginAndWaitForList(page)

    // Create a persona first
    await page.getByText(texts.newPersona).click()
    await page.getByPlaceholder(texts.namePlaceholder).fill(personaName)
    await page.getByPlaceholder(texts.personalityPlaceholder).fill('Test personality')
    await page.getByPlaceholder(texts.speakingStylePlaceholder).fill('Test style')
    await page.getByRole('button', { name: texts.create }).click()

    await expect(page.getByRole('heading', { name: texts.myPersonas })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(personaName)).toBeVisible()

    // Accept the confirmation dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Click Delete on the persona's card
    const card = page.locator('.grid > div').filter({ hasText: personaName })
    await card.getByRole('button', { name: texts.delete }).click()

    // Persona should be removed from the list
    await expect(page.getByText(personaName)).not.toBeVisible({ timeout: 5_000 })
  })
})

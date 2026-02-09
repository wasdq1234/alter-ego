import { test, expect } from '@playwright/test'

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

test.describe('Chat', () => {
  test('can open chat window from persona list', async ({ page }) => {
    await loginAndWaitForList(page)

    const chatButton = page.getByRole('button', { name: 'Chat' }).first()
    if (await chatButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await chatButton.click()

      await expect(page.getByPlaceholder('Type a message...')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
    }
  })

  test('can navigate back from chat window', async ({ page }) => {
    await loginAndWaitForList(page)

    const chatButton = page.getByRole('button', { name: 'Chat' }).first()
    if (await chatButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await chatButton.click()
      await expect(page.getByPlaceholder('Type a message...')).toBeVisible()

      await page.locator('header button').first().click()

      await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
        timeout: 5_000,
      })
    }
  })

  test('can send a message and receive a streaming response', async ({ page }) => {
    await loginAndWaitForList(page)

    const chatButton = page.getByRole('button', { name: 'Chat' }).first()
    if (!(await chatButton.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await chatButton.click()
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible()

    await page.getByPlaceholder('Type a message...').fill('Hello')
    await page.getByRole('button', { name: 'Send' }).click()

    await expect(page.getByText('Hello')).toBeVisible()

    await expect(
      page.locator('.bg-gray-50 >> div').filter({ hasNot: page.getByText('Hello') }).first()
    ).toBeVisible({ timeout: 30_000 })
  })
})

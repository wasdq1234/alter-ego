import { test, expect } from '@playwright/test'

test.describe('Chat', () => {
  test('can open chat window from persona list', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
      timeout: 10_000,
    })

    // Click the first "Chat" button if personas exist
    const chatButton = page.getByRole('button', { name: 'Chat' }).first()
    if (await chatButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await chatButton.click()

      // Chat window should show persona name in header and message input
      await expect(page.getByPlaceholder('Type a message...')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
    }
  })

  test('can navigate back from chat window', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
      timeout: 10_000,
    })

    const chatButton = page.getByRole('button', { name: 'Chat' }).first()
    if (await chatButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await chatButton.click()
      await expect(page.getByPlaceholder('Type a message...')).toBeVisible()

      // Click back arrow
      await page.locator('header button').first().click()

      // Should return to persona list
      await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
        timeout: 5_000,
      })
    }
  })

  test('can send a message and receive a streaming response', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
      timeout: 10_000,
    })

    const chatButton = page.getByRole('button', { name: 'Chat' }).first()
    if (!(await chatButton.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await chatButton.click()
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible()

    // Send a message
    await page.getByPlaceholder('Type a message...').fill('Hello')
    await page.getByRole('button', { name: 'Send' }).click()

    // User message should appear
    await expect(page.getByText('Hello')).toBeVisible()

    // Wait for assistant response (streaming may take a while)
    // The assistant message bubble has bg-white class
    await expect(
      page.locator('.bg-gray-50 >> div').filter({ hasNot: page.getByText('Hello') }).first()
    ).toBeVisible({ timeout: 30_000 })
  })
})

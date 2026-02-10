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

test.describe('Chat', () => {
  test('can open chat window from persona list', async ({ page }) => {
    await loginAndWaitForList(page)

    const chatButton = page.getByRole('button', { name: texts.chat }).first()
    await expect(chatButton).toBeVisible({ timeout: 10_000 })
    await chatButton.click()

    await expect(page.getByPlaceholder(texts.chatPlaceholder)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: texts.send })).toBeVisible()
  })

  test('can navigate back from chat window', async ({ page }) => {
    await loginAndWaitForList(page)

    const chatButton = page.getByRole('button', { name: texts.chat }).first()
    await expect(chatButton).toBeVisible({ timeout: 10_000 })
    await chatButton.click()
    await expect(page.getByPlaceholder(texts.chatPlaceholder)).toBeVisible({ timeout: 10_000 })

    await page.locator('header button').first().click()

    await expect(page.getByRole('heading', { name: texts.myPersonas })).toBeVisible({
      timeout: 5_000,
    })
  })

  test('can send a message and receive a streaming response', async ({ page }) => {
    await loginAndWaitForList(page)

    const chatButton = page.getByRole('button', { name: texts.chat }).first()
    await expect(chatButton).toBeVisible({ timeout: 10_000 })
    await chatButton.click()

    await expect(page.getByPlaceholder(texts.chatPlaceholder)).toBeVisible({ timeout: 10_000 })

    await page.getByPlaceholder(texts.chatPlaceholder).fill('Say hi')
    await page.getByRole('button', { name: texts.send }).click()

    await expect(page.getByText('Say hi')).toBeVisible({ timeout: 5_000 })

    const assistantBubble = page.locator('.justify-start .rounded-lg')
    await expect(assistantBubble.first()).toContainText(/.+/, { timeout: 30_000 })
  })
})

import { test as setup, expect } from '@playwright/test'
import { texts } from './i18n-helpers'

const TEST_EMAIL = 'test@alter-ego.dev'
const TEST_PASSWORD = 'test123456'

setup('authenticate', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText(texts.signInDesc)).toBeVisible()

  await page.getByPlaceholder(texts.email).fill(TEST_EMAIL)
  await page.getByPlaceholder(texts.password).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: texts.signIn }).click()

  await expect(page.getByRole('heading', { name: texts.myPersonas })).toBeVisible({
    timeout: 10_000,
  })

  await page.context().storageState({ path: 'e2e/.auth/user.json' })
})

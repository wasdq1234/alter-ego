import { test, expect } from '@playwright/test'
import { texts } from './i18n-helpers'

test.describe('Auth flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('shows login form by default', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(texts.signInDesc)).toBeVisible()
    await expect(page.getByPlaceholder(texts.email)).toBeVisible()
    await expect(page.getByPlaceholder(texts.password)).toBeVisible()
    await expect(page.getByRole('button', { name: texts.signIn })).toBeVisible()
  })

  test('can toggle between Sign In and Sign Up', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(texts.signInDesc)).toBeVisible()

    await page.getByRole('button', { name: texts.signUp }).click()
    await expect(page.getByText(texts.signUpDesc)).toBeVisible()

    await page.getByRole('button', { name: texts.signIn }).click()
    await expect(page.getByText(texts.signInDesc)).toBeVisible()
  })

  test('login with valid credentials navigates to persona list', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder(texts.email).fill('test@alter-ego.dev')
    await page.getByPlaceholder(texts.password).fill('test123456')
    await page.getByRole('button', { name: texts.signIn }).click()

    await expect(page.getByRole('heading', { name: texts.myPersonas })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder(texts.email).fill('wrong@example.com')
    await page.getByPlaceholder(texts.password).fill('wrongpassword')
    await page.getByRole('button', { name: texts.signIn }).click()

    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Authenticated user', () => {
  test('can sign out', async ({ page }) => {
    await page.route(
      (url) => url.pathname.includes('/auth/v1/logout'),
      (route) => route.fulfill({ status: 204, body: '' }),
    )

    await page.goto('/')
    await expect(page.getByRole('heading', { name: texts.myPersonas })).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: texts.signOut }).click()

    await expect(page.getByText(texts.signInDesc)).toBeVisible({
      timeout: 5_000,
    })
  })
})

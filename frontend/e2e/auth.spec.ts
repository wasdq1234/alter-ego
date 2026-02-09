import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('shows login form by default', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Sign in to your account')).toBeVisible()
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('can toggle between Sign In and Sign Up', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Sign in to your account')).toBeVisible()

    await page.getByRole('button', { name: 'Sign Up' }).click()
    await expect(page.getByText('Create a new account')).toBeVisible()

    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText('Sign in to your account')).toBeVisible()
  })

  test('login with valid credentials navigates to persona list', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Email').fill('test@alter-ego.dev')
    await page.getByPlaceholder('Password').fill('test123456')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Email').fill('wrong@example.com')
    await page.getByPlaceholder('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Authenticated user', () => {
  test('can sign out', async ({ page }) => {
    // Intercept Supabase logout API to prevent server-side token revocation.
    // Uses URL predicate (not glob) to match requests with query params like ?scope=global.
    await page.route(
      (url) => url.pathname.includes('/auth/v1/logout'),
      (route) => route.fulfill({ status: 204, body: '' }),
    )

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: 'Sign Out' }).click()

    await expect(page.getByText('Sign in to your account')).toBeVisible({
      timeout: 5_000,
    })
  })
})

import { test as setup, expect } from '@playwright/test'

const TEST_EMAIL = 'test@alter-ego.dev'
const TEST_PASSWORD = 'test123456'

setup('authenticate', async ({ page }) => {
  await page.goto('/')

  // AuthForm should be visible
  await expect(page.getByText('Sign in to your account')).toBeVisible()

  // Fill in credentials
  await page.getByPlaceholder('Email').fill(TEST_EMAIL)
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Wait for persona list page to load (header with "Alter Ego" and "My Personas")
  await expect(page.getByRole('heading', { name: 'My Personas' })).toBeVisible({
    timeout: 10_000,
  })

  // Save storage state (includes Supabase session in localStorage)
  await page.context().storageState({ path: 'e2e/.auth/user.json' })
})

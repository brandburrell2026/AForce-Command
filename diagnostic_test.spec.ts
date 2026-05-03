import { test, expect } from '@playwright/test';

test('diagnostic sign-in and sign-up', async ({ page }) => {
  const signInUrl = 'https://745ad57f-0f0d-4501-8ad0-cf0ad11b0793-00-1v0pftneu0ux4.expo.kirk.replit.dev/(auth)/sign-in';
  const signUpUrl = 'https://745ad57f-0f0d-4501-8ad0-cf0ad11b0793-00-1v0pftneu0ux4.expo.kirk.replit.dev/(auth)/sign-up';

  page.on('console', msg => {
    console.log('BROWSER CONSOLE: ' + msg.type() + ' ' + msg.text());
  });

  page.on('response', response => {
    const url = response.url();
    if (url.includes('clerk')) {
      console.log('CLERK RESPONSE: ' + url + ' ' + response.status());
    }
  });

  // 1. Sign In
  console.log('--- STARTING SIGN IN DIAGNOSTIC ---');
  try {
    await page.goto(signInUrl);
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 15000 });

    await page.getByLabel('Email address').fill('test+aforce@example.com');
    await page.getByLabel('Password').fill('TestPass123!@');
    
    console.log('Clicking Sign in button...');
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    await page.waitForTimeout(5000);
    
    console.log('Final Sign In URL: ' + page.url());
    const signInError = await page.locator('text=/.*(failed|invalid|error).*/i').first().innerText().catch(() => 'No visible error text');
    console.log('Sign In Visible UI Feedback: ' + signInError);
  } catch (e) {
    console.log('Sign In Flow Failed: ' + e.message);
  }

  // 2. Sign Up
  console.log('\n--- STARTING SIGN UP DIAGNOSTIC ---');
  try {
    await page.goto(signUpUrl);
    await expect(page.getByText('Create account')).toBeVisible({ timeout: 15000 });

    await page.getByLabel('Email address').fill('newuser+aforce@example.com');
    await page.getByLabel('Password').fill('NewPass123!@');
    
    console.log('Clicking Continue button...');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.waitForTimeout(5000);
    
    console.log('Final Sign Up URL: ' + page.url());
    const signUpError = await page.locator('text=/.*(failed|invalid|error).*/i').first().innerText().catch(() => 'No visible error text');
    console.log('Sign Up Visible UI Feedback: ' + signUpError);
    
    const verifyVisible = await page.getByText('Verify your email').isVisible();
    console.log('Is Verify your email screen visible? ' + verifyVisible);
  } catch (e) {
    console.log('Sign Up Flow Failed: ' + e.message);
  }
});

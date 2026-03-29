import { test, expect } from '@playwright/test';

const TEST_PUBKEY = process.env.TEST_PUBKEY || 'npub1z7cg4wuqy8w0yvdgkss2qh6l5hln8mc5d7nrq8n3rs7j9v3vk4vs8k2nk7';
const MOCK_PUBKEY = 'npub1z7cg4wuqy8w0yvdgkss2qh6l5hln8mc5d7nrq8n3rs7j9v3vk4vs8k2nk7';

test.describe('NIP-07 Login', () => {
  test('should open login modal when clicking center button without being logged in', async ({ page }) => {
    await page.goto('/');
    
    const centerButton = page.locator('#centerBtn');
    await centerButton.click();
    
    const loginModal = page.locator('.modal-bg');
    await expect(loginModal).toBeVisible({ timeout: 5000 });
    
    const loginButton = page.locator('button.auth-btn').first();
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toContainText('Login con extensión');
  });

  test('should login with NIP-07 extension mock on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.addInitScript((pubkey) => {
      Object.defineProperty(window, 'nostr', {
        value: {
          getPublicKey: async () => pubkey,
          signEvent: async (e) => ({ 
            ...e, 
            id: 'abc123',
            sig: 'sig123' 
          })
        },
        writable: true
      });
    }, MOCK_PUBKEY);
    
    await page.goto('/');
    
    const centerButton = page.locator('#centerBtn');
    await centerButton.click();
    
    const loginButton = page.locator('button.auth-btn').first();
    await loginButton.click();
    
    await page.waitForTimeout(2000);
    
    await expect(page.locator('.auth-error')).not.toBeVisible({ timeout: 5000 });
  });

  test('should login with real NIP-07 extension when available', async ({ page }) => {
    await page.goto('/');
    
    const extensionAvailable = await page.evaluate(() => !!(window as any).nostr);
    
    if (!extensionAvailable) {
      test.skip();
    }
    
    const centerButton = page.locator('#centerBtn');
    await centerButton.click();
    
    const loginButton = page.locator('button.auth-btn').first();
    await loginButton.click();
    
    await expect(page.locator('.auth-error')).not.toBeVisible({ timeout: 10000 });
  });

  test('should use TEST_PUBKEY env for verification', async ({ page }) => {
    if (!process.env.TEST_PUBKEY) {
      test.skip();
    }
    
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.addInitScript((pubkey) => {
      Object.defineProperty(window, 'nostr', {
        value: {
          getPublicKey: async () => pubkey,
          signEvent: async (e: any) => ({ 
            ...e, 
            id: 'abc123',
            sig: 'sig123' 
          })
        },
        writable: true
      });
    }, TEST_PUBKEY);
    
    await page.goto('/');
    
    const centerButton = page.locator('#centerBtn');
    await centerButton.click();
    
    const loginButton = page.locator('button.auth-btn').first();
    await loginButton.click();
    
    await page.waitForTimeout(3000);
    
    const response = await page.request.get(`/api/identity/${TEST_PUBKEY}`);
    expect(response.ok()).toBeTruthy();
  });
});

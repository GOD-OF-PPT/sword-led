import type { Page } from '@playwright/test';

export async function tabTo(page: Page, selector: string) {
  for (let i=0;i<80;i++) {
    if (await page.locator(selector).evaluate(element=>document.activeElement===element)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard cannot reach ${selector}`);
}
export async function keyActivate(page: Page, selector: string) { await tabTo(page,selector);await page.keyboard.press('Enter'); }

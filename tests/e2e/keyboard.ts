import type { Page } from '@playwright/test';

export async function tabTo(page: Page, selector: string) {
  for (let i=0;i<80;i++) {
    if (await page.locator(selector).evaluate(element=>document.activeElement===element)) return;
    const backwards = await page.locator(selector).evaluate(element => Boolean(document.activeElement
      && (document.activeElement.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING)));
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Keyboard cannot reach ${selector}`);
}
export async function keyActivate(page: Page, selector: string) { await tabTo(page,selector);await page.keyboard.press('Enter'); }

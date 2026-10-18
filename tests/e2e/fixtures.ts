import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const test = base.extend<{ runtimeAudit: { allowHttpStatus(status: number): void } }>({
  runtimeAudit: [async ({ page, context }, use, info) => {
    const errors: string[] = [], consoleErrors: string[] = [], http: { status: number; url: string }[] = [];
    const allowed = new Set<number>(), observed = new Set<Page>();
    const observe = (target: Page) => {
      if (observed.has(target)) return;observed.add(target);
      target.on('pageerror', error => errors.push(error.message));
      target.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      target.on('response', response => { if (response.status() >= 400) http.push({ status: response.status(), url: response.url() }); });
    };
    observe(page);context.on('page', observe);
    await use({ allowHttpStatus: status => { allowed.add(status); } });context.off('page', observe);
    const unexpectedConsole = consoleErrors.filter(message => ![...allowed].some(status => message.includes('Failed to load resource') && message.includes(String(status))));
    const unexpectedHttp = http.filter(response => !allowed.has(response.status));
    await info.attach('runtime-audit', { body: Buffer.from(JSON.stringify({ errors, consoleErrors, http, allowedHttpStatuses: [...allowed] }, null, 2)), contentType: 'application/json' });
    expect(errors).toEqual([]);expect(unexpectedConsole).toEqual([]);expect(unexpectedHttp).toEqual([]);
  }, { auto: true }],
});
export { expect };

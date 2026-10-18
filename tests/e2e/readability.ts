import type { Page } from '@playwright/test';

export async function textReadability(page: Page, selector: string) {
  return page.locator(selector).evaluateAll(elements => {
    const parse = (value: string) => { const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0,0,0];return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1]; };
    const luminance = (rgb: number[]) => {
      const values = rgb.slice(0,3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return .2126 * (values[0] ?? 0) + .7152 * (values[1] ?? 0) + .0722 * (values[2] ?? 0);
    };
    return elements.filter(el => el.getClientRects().length && el.textContent?.trim()).map(el => {
      const ancestors: Element[] = [];for (let current: Element | null = el; current; current = current.parentElement) ancestors.unshift(current);
      let background = [255,255,255];
      for (const ancestor of ancestors) { const color = parse(getComputedStyle(ancestor).backgroundColor), alpha = color[3] ?? 1;background = background.map((v, i) => v * (1 - alpha) + (color[i] ?? 0) * alpha); }
      const style = getComputedStyle(el), a = luminance(parse(style.color)), b = luminance(background);
      return { text: el.textContent?.trim().slice(0,60), fontSize: parseFloat(style.fontSize), contrast: (Math.max(a,b) + .05) / (Math.min(a,b) + .05) };
    });
  });
}

const CONTROLS = 'button,input:not([type=hidden]),select,textarea,summary,a[href]';

/** Explicit zero keeps the authored DOM order available with desktop WebKit keyboard preferences. */
export function enableKeyboardNavigation(root: HTMLElement) {
  for (const element of root.querySelectorAll<HTMLElement>(CONTROLS)) if (!element.hasAttribute('tabindex')) element.tabIndex = 0;
}

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  if (node.matches(CONTROLS)) node.tabIndex = 0;
  return node;
}

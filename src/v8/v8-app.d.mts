export interface V8AppHandle {
  dispose(): void;
}
export function mountV8App(
  root: HTMLElement,
  artMap: Readonly<Record<string, string>>,
  options?: { readonly showClassicLink?: boolean }
): V8AppHandle;

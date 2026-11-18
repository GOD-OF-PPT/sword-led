export interface MountV8Options {
  showClassicLink?: boolean;
}

export interface MountedV8Handle {
  getState: () => unknown;
  dispatch: (action: Record<string, unknown>) => boolean;
  dispose: () => void;
}

export function mountV8App(
  rootEl: HTMLElement,
  artMap?: Record<string, string>,
  options?: MountV8Options
): MountedV8Handle;

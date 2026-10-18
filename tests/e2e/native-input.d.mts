export function verifyNativeInput(baseURL: string, screenshotPath: string): Promise<{
  browser: string; nativeMinimizedHidden: boolean; nativeBlurObserved: boolean; staleKeyupObserved: number;
  cancelledRawSaveUnchanged: boolean; finalRevision: number; finalStrikes: number; finalStrikeDraws: number;
  finalTimingMark: number; viewport: {width:number;height:number}; errors: string[];
}>;

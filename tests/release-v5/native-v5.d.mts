export type NativeV5Scenario='space-minimize'|'pointer-minimize'|'clean-cache'|'dirty-cache'|'memory-cache'|'stale-cache';
export interface NativeV5Result {
 scope:string;scenario:NativeV5Scenario;passed:boolean;
 launch:{executablePath:string;headless:boolean;pid:number;profile:string;command:string[]};
 browser:{product:string;protocolVersion:string};
 states:readonly unknown[];collections:readonly unknown[];
 observations:readonly unknown[];protocolEvents:readonly unknown[];commands:readonly unknown[];
 summary:Record<string,boolean|number>;errors:string[];
 closed?:{profileRemoved:boolean;pid:number;exitCode:number|null;signal:string|null;error:string|null};
}
export function verifyNativeV5(baseURL:string,artifactDir:string,scenario:NativeV5Scenario,audio?:{initSource:string;snapshotSource:string}):Promise<NativeV5Result>;
export function createNativeV5RestoreFixture():Promise<{scope:string;state:unknown;run:string;collection:string}>;

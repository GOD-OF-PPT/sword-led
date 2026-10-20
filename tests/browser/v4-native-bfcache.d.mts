import type {Action} from '../../src/core-v4/model.js';
export function verifyNativeV4Bfcache(baseURL:string,input:{runId:string;seed:string;first:readonly Action[];following:readonly Action[]}):Promise<{
 browser:string;nativePersisted:boolean;heapRetained:boolean;restoredMode:string;resumedMode:string;staleRejected:string;states:readonly unknown[];collection:unknown;restoredCollection:unknown;changedCollection:unknown;equality:{rawJSONState:boolean;rawJSONCollection:boolean;state:boolean;collection:boolean};
}>;

import {element as domElement} from '../presentation/dom.js';

/** Current workshop vocabulary; domain records and legacy pages keep their own text. */
export function workshopText(value:string){return value.replaceAll('身价','估值').replaceAll('金币','铜钱');}

export function element<K extends keyof HTMLElementTagNameMap>(tag:K,value?:string,className?:string):HTMLElementTagNameMap[K]{
 const literal=tag==='pre'||tag==='code'||tag==='textarea'||tag==='input';
 return domElement(tag,value===undefined||literal?value:workshopText(value),className);
}

import type {Blade} from '../core-v3/index.js';
import type {ImpactPoint} from './impact.js';
import {bladeAppearance} from './appearance.js';
import {BLADE_SURFACES} from './surface-data.js';
/** Cosmetic contact follows the real upper edge; mouse position never affects a rule. */
export function bladeContact(blade:Blade|null,point:ImpactPoint,illustrated:boolean):ImpactPoint{
 const x=Math.max(.36,Math.min(.82,point.x));if(!blade)return{x,y:.6};
 if(!illustrated)return{x,y:(218-6*Math.min(5,Math.floor(blade.level/3)))/400};
 const look=bladeAppearance(blade),profile=BLADE_SURFACES[look.family]![look.stage]!,t=(x-.36)/.46*20,index=Math.min(19,Math.floor(t)),mix=t-index;
 return{x,y:profile[index]!*(1-mix)+profile[index+1]!*mix};
}

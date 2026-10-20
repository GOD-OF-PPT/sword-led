import {describe,it,expect} from 'vitest';
import {forgeAppearance,forgeContact} from '../../src/presentation-v4/forge.js';
import {createRun,applyCommand} from '../../src/core-v4/index.js';
import type {Blade,Recipe} from '../../src/core-v4/index.js';
import {BLADE_SURFACES} from '../../src/presentation-v3/surface-data.js';

function blade(recipe:Recipe,level:number):Blade{
  const state=createRun({runId:'appearance',seed:'appearance'});if(!state.ok)throw new Error('create failed');
  const opened=applyCommand(state.state,{runId:'appearance',expectedRevision:0,action:{type:'continue'}});if(!opened.ok)throw new Error('open failed');
  return {...opened.state.blades[0]!,recipe,level};
}
describe('v4 readonly forge geometry',()=>{
  it('uses the chosen recipe for all five growth forms, independent of real piece IDs',()=>{
    for(const [family,recipe]of(['light','guard','heavy']as const).entries()){
      for(const [stage,level]of[0,1,3,6,9].entries()){
        const actual=Object.freeze({...blade(recipe,level),id:'run-id-with-no-family-987'}),before=JSON.stringify(actual);
        expect(forgeAppearance(actual)).toMatchObject({family,stage});expect(JSON.stringify(actual)).toBe(before);
      }
    }
  });
  it('projects the measured alpha upper edge through the real letterboxed canvas rectangle',()=>{
    const scene={left:100,top:50,width:880,height:430},canvas={left:100,top:105,width:880,height:320};
    for(const [family,recipe]of(['light','guard','heavy']as const).entries()){
      for(const [stage,level]of[0,1,3,6,9].entries()){
        const piece=blade(recipe,level),point=forgeContact(piece,{x:.59,y:.1},true,scene,canvas);
        expect(point.x).toBeCloseTo(.59,10);expect(point.y).toBeCloseTo((55+BLADE_SURFACES[family]![stage]![10]!*320)/430,10);
      }
    }
  });
  it('clamps contact to the measured steel and follows the native fallback upper edge',()=>{
    const rect={left:0,top:0,width:1100,height:400},piece=blade('heavy',6);
    expect(forgeContact(piece,{x:-8,y:9},false,rect,rect)).toEqual({x:.36,y:206/400});
    expect(forgeContact(piece,{x:8,y:-9},false,rect,rect).x).toBeCloseTo(.82,10);
  });
});

import {describe,it,expect} from 'vitest';
import {createRun} from '../../src/core-v7/initial.js';
import {beginEncounter,encounterOutcome,pressurePreview,legalTarget} from '../../src/core-v7/encounters.js';
import type {Draft,EncounterId} from '../../src/core-v7/model.js';
function scene(id:EncounterId):Draft{const r=createRun({runId:'encounter-check',seed:'clear'});if(!r.ok)throw Error(r.error);const d=structuredClone(r.state) as Draft;beginEncounter(d,id,[]);return d;}
describe('v7 authored encounters',()=>{
 it('discloses live intentions, independent weather and real reductions',()=>{
  const d=scene('n3-main');d.flags.escortFirst=true;
  expect(pressurePreview(d)).toEqual({pressure:3,reduction:1,block:0,loss:2});
  d.encounter!.targets[0]!.health=0;expect(pressurePreview(d).loss).toBe(0);
  d.encounter!.round=2;expect(pressurePreview(d).loss).toBe(3);
  const final=scene('n9');final.flags.ring='taken';final.encounter!.round=3;final.encounter!.block=3;
  expect(pressurePreview(final)).toEqual({pressure:5,reduction:2,block:3,loss:0});
 });
 it('requires the drive lock and a real end-of-round survival result',()=>{
  const d=scene('n9');expect(legalTarget(d,'reverse-wheel')).toBeNull();d.encounter!.targets[0]!.health=0;
  expect(legalTarget(d,'reverse-wheel')).not.toBeNull();d.encounter!.targets[1]!.health=0;
  expect(encounterOutcome(d)).toBeNull();
  const hold=scene('n3-extra');expect(encounterOutcome(hold)).toBeNull();expect(encounterOutcome(hold,true)).toBe('completed');
  hold.lamp=0;expect(encounterOutcome(hold,true)).toBe('light-exhausted');
 });
 it('preclears only the helped north route and keeps sub-encounters independent',()=>{
  const d=scene('n7');d.flags.northSaved=true;d.flags.ring='left';beginEncounter(d,'n7',[]);
  expect(d.encounter!.targets.find(t=>t.id==='loose-rock')!.health).toBe(0);
  d.encounter!.actions=0;d.encounter!.opening=true;d.encounter!.block=9;d.charge=0;
  beginEncounter(d,'n3-extra',[]);expect(d.encounter).toMatchObject({actions:2,opening:false,block:0,round:1});expect(d.charge).toBe(0);
 });
});

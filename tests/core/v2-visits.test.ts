import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {getCustomerVisits,validateRun} from '../../src/core-v2/index.js';

test('actual twelve-round UI save exposes final client visits at contract end without paying again',()=>{
  const archive=JSON.parse(readFileSync('docs/evidence/T11-3/polish-runtime/ui/d-keyboard-campaign.json','utf8')),checked=validateRun(archive.state);if(!checked.ok)throw Error(checked.detail);const state=checked.state,before=JSON.stringify(state),visits=getCustomerVisits(state);expect(state.phase).toBe('victory');const late=visits.filter(v=>v.dueRound>12);expect(late.map(v=>v.pieceId)).toEqual(['11:1','12:1']);expect(late.every(v=>v.receivedRound===12&&v.scrap===1)).toBe(true);expect(late[1]).toMatchObject({pieceId:'12:1',trial:{cut:7,block:5,handling:4},piece:{status:'delivered',ratings:{edge:21,toughness:17,balance:13}}});expect(new Set(visits.map(v=>v.requestId)).size).toBe(visits.length);expect(Object.isFrozen(visits[0]?.piece)).toBe(true);expect(JSON.stringify(state)).toBe(before);
});

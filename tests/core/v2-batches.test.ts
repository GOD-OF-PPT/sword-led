import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {batch,partition,PROFILES} from '../../scripts/v2/batch.js';
import {simulateV2} from '../../scripts/v2/policy.js';

test('all 29 profiles partition into exactly 1000 unique fixed seeds, including the last partial chunk',()=>{
  const chunks=partition(1000,27);expect(PROFILES).toHaveLength(29);expect(chunks).toHaveLength(29*38);
  const ids=chunks.flatMap(c=>Array.from({length:c.count},(_,i)=>`${c.profile.join('/')}/${c.start+i}`));
  expect(ids).toHaveLength(29000);expect(new Set(ids).size).toBe(29000);expect(chunks.at(-1)).toMatchObject({start:999,count:1});
  expect(()=>partition(0)).toThrow();expect(()=>partition(1001)).toThrow();expect(()=>partition(1,0)).toThrow();
});
test('worker batches retain the exact formal policy result and state digest without changing seed order',()=>{
  const profile=['balanced','edgeTooth','steady'] as const,result=batch({profile,start:0,count:1}),single=simulateV2('v2-verify-0000',...profile);
  expect(result.rows).toEqual([{...single.row,stateSha256:createHash('sha256').update(JSON.stringify(single.state)).digest('hex')}]);
  expect(result.witnesses.victory).toEqual(single.state);
  const raw=batch({profile:['raw','bridgeClip','perfect'],start:2,count:2});expect(raw.rows.map(r=>r.seed)).toEqual(['v2-verify-0002','v2-verify-0003']);expect(raw.rows.every(r=>r.phase==='defeat'&&r.rounds===3)).toBe(true);
},15000);
